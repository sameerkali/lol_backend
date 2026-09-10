const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok, created } = require("../utils/ApiResponse");
const Business = require("../models/Business");
const Customer = require("../models/Customer");
const Visit = require("../models/Visit");
const loyaltyService = require("../services/loyalty.service");
const { BUSINESS_STATUS } = require("../constants/loyalty");

async function loadActiveBusiness(slug) {
  const business = await Business.findOne({ slug, status: BUSINESS_STATUS.ACTIVE });
  if (!business) throw ApiError.notFound("This loyalty page is not available");
  return business;
}

// Safe subset of business config the customer page needs to render itself.
function publicBusinessView(business) {
  return {
    id: business._id,
    name: business.name,
    slug: business.slug,
    branding: business.branding,
    earningMode: business.earningMode,
    amountPerPoint: business.amountPerPoint,
    minBillAmount: business.minBillAmount,
    billAmountFieldEnabled: business.billAmountFieldEnabled,
    checkInMode: business.checkInMode,
    signupFields: business.signupFields,
    headStart: business.headStart,
    birthdayReward: business.birthdayReward.enabled
      ? { label: business.birthdayReward.label, rewardType: business.birthdayReward.rewardType }
      : { enabled: false },
    milestones: business.milestones,
    tiers: business.tiers,
    afterFinalMilestone: business.afterFinalMilestone,
  };
}

const getBusiness = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  ok(res, publicBusinessView(business));
});

const lookupCustomer = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  const { phone } = req.body;
  if (!phone) throw ApiError.badRequest("phone is required");

  const customer = await Customer.findOne({ business: business._id, phone });
  if (!customer) {
    return ok(res, { exists: false, signupFields: business.signupFields });
  }
  ok(res, { exists: true, card: loyaltyService.buildCardView(customer) });
});

const signup = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  const { phone, name, email, birthday } = req.body;
  if (!phone) throw ApiError.badRequest("phone is required");

  const customer = await loyaltyService.createCustomer(business, { phone, name, email, birthday });
  created(res, { card: loyaltyService.buildCardView(customer) });
});

const getCard = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  const customer = await Customer.findOne({ business: business._id, phone: req.params.phone });
  if (!customer) throw ApiError.notFound("Customer not found");
  ok(res, loyaltyService.buildCardView(customer));
});

const getHistory = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  const customer = await Customer.findOne({ business: business._id, phone: req.params.phone });
  if (!customer) throw ApiError.notFound("Customer not found");

  const history = await Visit.find({ business: business._id, customer: customer._id }).sort({ createdAt: -1 });
  ok(res, history);
});

const markVisit = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  const { phone, billAmount, pin } = req.body;
  if (!phone) throw ApiError.badRequest("phone is required");

  const customer = await Customer.findOne({ business: business._id, phone });
  if (!customer) throw ApiError.notFound("Customer not found — sign up first");

  const result = await loyaltyService.markVisit(business, customer, { billAmount, pin });

  ok(res, {
    card: loyaltyService.buildCardView(result.customer),
    newlyUnlocked: result.newlyUnlocked,
    cardAdvanced: result.cardAdvanced,
    stampAwarded: result.visit.stampAwarded,
    note: result.reason,
  });
});

const redeem = asyncHandler(async (req, res) => {
  const business = await loadActiveBusiness(req.params.slug);
  const { phone, milestoneUnlockedId, pin } = req.body;
  if (!phone || !milestoneUnlockedId) throw ApiError.badRequest("phone and milestoneUnlockedId are required");

  const customer = await Customer.findOne({ business: business._id, phone });
  if (!customer) throw ApiError.notFound("Customer not found");

  const result = await loyaltyService.redeemReward(business, customer, { milestoneUnlockedId, pin });
  ok(res, { card: loyaltyService.buildCardView(result.customer), redeemedReward: result.reward });
});

module.exports = { getBusiness, lookupCustomer, signup, getCard, getHistory, markVisit, redeem };
