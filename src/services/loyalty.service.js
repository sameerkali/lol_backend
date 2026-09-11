const ApiError = require("../utils/ApiError");
const Customer = require("../models/Customer");
const Visit = require("../models/Visit");
const { EARNING_MODES, AFTER_FINAL_MILESTONE, CHECK_IN_MODES, VISIT_TYPES } = require("../constants/loyalty");

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Create a new customer "card" for a business, applying head-start stamps
 * and snapshotting the business's current rules for this card cycle.
 */
async function createCustomer(business, { phone, name, email, birthday }) {
  const existing = await Customer.findOne({ business: business._id, phone });
  if (existing) throw ApiError.conflict("A customer with this phone number already exists for this business");

  const ruleSnapshot = business.buildRuleSnapshot(0);

  const customer = new Customer({
    business: business._id,
    phone,
    name: business.signupFields.name ? name || "" : "",
    email: business.signupFields.email ? email || "" : "",
    birthday: business.signupFields.birthday ? birthday || null : null,
    ruleSnapshot,
    count: 0,
    cardCycle: 0,
  });

  if (business.headStart.enabled && business.headStart.stamps > 0) {
    customer.count = business.headStart.stamps;
    customer.totalPoints = business.headStart.stamps;
  }

  applyMilestoneUnlocks(customer);
  await customer.save();
  return customer;
}

function applyMilestoneUnlocks(customer) {
  const alreadyUnlocked = new Set(
    customer.milestonesUnlocked.filter((u) => u.cardCycle === customer.cardCycle).map((u) => String(u.milestoneId))
  );

  const newlyUnlocked = [];
  for (const milestone of customer.ruleSnapshot.milestones) {
    if (milestone.count <= customer.count && !alreadyUnlocked.has(String(milestone.milestoneId))) {
      const entry = {
        milestoneId: milestone.milestoneId,
        count: milestone.count,
        cardCycle: customer.cardCycle,
        tierName: customer.ruleSnapshot.tierName,
        label: milestone.label,
        rewardType: milestone.rewardType,
        rewardValue: milestone.rewardValue,
        unlockedAt: new Date(),
        redeemed: false,
      };
      customer.milestonesUnlocked.push(entry);
      newlyUnlocked.push(entry);
    }
  }
  return newlyUnlocked;
}

function maxMilestoneCount(ruleSnapshot) {
  if (!ruleSnapshot.milestones.length) return null;
  return Math.max(...ruleSnapshot.milestones.map((m) => m.count));
}

/**
 * When a customer completes their milestone ladder, either reset the card
 * or move them to the next tier — using the business's *current* rules,
 * since "new rules apply from their next card" per the BRD.
 */
function advanceCardIfComplete(customer, business) {
  const max = maxMilestoneCount(customer.ruleSnapshot);
  if (max === null || customer.count < max) return false;

  if (customer.ruleSnapshot.afterFinalMilestone === AFTER_FINAL_MILESTONE.NEXT_TIER && business.tiers.length > 0) {
    const nextTierIndex = customer.ruleSnapshot.tierIndex + 1;
    if (nextTierIndex >= business.tiers.length) {
      return false; // already on the top tier, stay maxed out
    }
    customer.cardCycle += 1;
    customer.count = 0;
    customer.ruleSnapshot = business.buildRuleSnapshot(nextTierIndex);
    return true;
  }

  // default: reset
  customer.cardCycle += 1;
  customer.count = 0;
  customer.ruleSnapshot = business.buildRuleSnapshot(0);
  return true;
}

function computeStamps(business, customer, billAmount) {
  switch (business.earningMode) {
    case EARNING_MODES.BILL_AMOUNT: {
      if (!billAmount || billAmount <= 0) return { stamps: 0, reason: "Bill amount is required for this earning mode" };
      const stamps = Math.floor(billAmount / business.amountPerPoint);
      return { stamps, reason: stamps === 0 ? "Bill amount below the minimum needed to earn a point" : null };
    }
    case EARNING_MODES.VISITS_WITH_MIN_BILL: {
      if (business.billAmountFieldEnabled && (!billAmount || billAmount < business.minBillAmount)) {
        return { stamps: 0, reason: `Bill amount must be at least ${business.minBillAmount} to count this visit` };
      }
      return { stamps: 1, reason: null };
    }
    case EARNING_MODES.VISITS:
    default:
      return { stamps: 1, reason: null };
  }
}

/**
 * Mark a visit for a customer: applies check-in mode (automatic / PIN),
 * the daily stamp limit, earning-mode math, milestone unlocks and card
 * advancement, then logs the visit.
 */
async function markVisit(business, customer, { billAmount, pin } = {}) {
  let confirmedBy = CHECK_IN_MODES.AUTOMATIC;
  if (business.checkInMode === CHECK_IN_MODES.PIN) {
    if (!pin) throw ApiError.badRequest("Business PIN is required to confirm this visit");
    const valid = await business.comparePin(pin);
    if (!valid) throw ApiError.unauthorized("Incorrect PIN");
    confirmedBy = CHECK_IN_MODES.PIN;
  }

  const today = dateKey();
  if (customer.lastVisitDateKey !== today) {
    customer.lastVisitDateKey = today;
    customer.visitsToday = 0;
  }

  const withinDailyLimit = business.stampLimitPerDay <= 0 || customer.visitsToday < business.stampLimitPerDay;
  let stamps = 0;
  let reason = null;

  if (!withinDailyLimit) {
    reason = `Daily stamp limit (${business.stampLimitPerDay}) already reached for today`;
  } else {
    const result = computeStamps(business, customer, billAmount);
    stamps = result.stamps;
    reason = result.reason;
  }

  customer.totalVisits += 1;
  customer.visitsToday += 1;
  customer.lastVisitAt = new Date();

  let newlyUnlocked = [];
  let cardAdvanced = false;

  if (stamps > 0) {
    customer.count += stamps;
    customer.totalPoints += stamps;
    newlyUnlocked = applyMilestoneUnlocks(customer);
    cardAdvanced = advanceCardIfComplete(customer, business);
    if (cardAdvanced) {
      // a fresh card may immediately re-check head-start-like unlocks (count starts at 0, so none)
    }
  }

  await customer.save();

  const visit = await Visit.create({
    business: business._id,
    customer: customer._id,
    type: VISIT_TYPES.VISIT,
    billAmount: billAmount ?? null,
    pointsEarned: stamps,
    stampAwarded: stamps > 0,
    confirmedBy,
    countAfter: customer.count,
    milestonesReached: newlyUnlocked.map((m) => m.count),
    note: reason || "",
  });

  return { customer, visit, newlyUnlocked, cardAdvanced, reason };
}

/**
 * Redeem an unlocked reward. Always requires the business PIN, regardless
 * of the check-in mode, per the BRD.
 */
async function redeemReward(business, customer, { milestoneUnlockedId, pin }) {
  if (!pin) throw ApiError.badRequest("Business PIN is required to redeem a reward");
  const valid = await business.comparePin(pin);
  if (!valid) throw ApiError.unauthorized("Incorrect PIN");

  const reward = customer.milestonesUnlocked.id(milestoneUnlockedId);
  if (!reward) throw ApiError.notFound("Reward not found");
  if (reward.redeemed) throw ApiError.conflict("Reward has already been redeemed");

  reward.redeemed = true;
  reward.redeemedAt = new Date();
  customer.totalRedemptions += 1;

  await customer.save();

  const visit = await Visit.create({
    business: business._id,
    customer: customer._id,
    type: VISIT_TYPES.REDEMPTION,
    confirmedBy: CHECK_IN_MODES.PIN,
    milestoneUnlockedId: reward._id,
    rewardLabel: reward.label,
    rewardType: reward.rewardType,
    rewardValue: reward.rewardValue,
  });

  return { customer, visit, reward };
}

function buildCardView(customer) {
  const { ruleSnapshot } = customer;
  const ladder = [...ruleSnapshot.milestones]
    .sort((a, b) => a.count - b.count)
    .map((m) => ({
      milestoneId: m.milestoneId,
      count: m.count,
      label: m.label,
      rewardType: m.rewardType,
      rewardValue: m.rewardValue,
      unlocked: customer.count >= m.count,
    }));

  const next = ladder.find((m) => !m.unlocked) || null;
  const max = ladder.length ? ladder[ladder.length - 1].count : null;
  const previousThreshold = [...ladder].reverse().find((m) => m.unlocked)?.count ?? 0;
  const span = next ? next.count - previousThreshold : 0;
  const progressPercent = next ? Math.round(((customer.count - previousThreshold) / span) * 100) : 100;

  return {
    phone: customer.phone,
    name: customer.name,
    email: customer.email,
    birthday: customer.birthday,
    count: customer.count,
    cardCycle: customer.cardCycle,
    tierName: ruleSnapshot.tierName,
    earningMode: ruleSnapshot.earningMode,
    ladder,
    nextMilestone: next,
    maxMilestone: max,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    availableRewards: customer.milestonesUnlocked.filter((r) => !r.redeemed),
    totalVisits: customer.totalVisits,
    totalPoints: customer.totalPoints,
    totalRedemptions: customer.totalRedemptions,
    lastVisitAt: customer.lastVisitAt,
  };
}

module.exports = {
  createCustomer,
  markVisit,
  redeemReward,
  buildCardView,
  applyMilestoneUnlocks,
};
