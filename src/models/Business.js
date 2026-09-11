const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { EARNING_MODES, REWARD_TYPES, AFTER_FINAL_MILESTONE, CHECK_IN_MODES, BUSINESS_STATUS, PLANS } = require("../constants/loyalty");

const milestoneSchema = new mongoose.Schema(
  {
    count: { type: Number, required: true, min: 1 },
    rewardType: { type: String, enum: Object.values(REWARD_TYPES), required: true },
    rewardValue: { type: String, default: "" },
    label: { type: String, default: "" },
  },
  { _id: true, timestamps: false }
);

const tierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    milestones: { type: [milestoneSchema], default: [] },
  },
  { _id: true, timestamps: false }
);

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    template: { type: String, default: "blank" },

    owner: {
      email: { type: String, required: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true },
    },

    pinHash: { type: String, default: null },
    pinEncrypted: { type: String, default: null }, // reversible copy so the owner/admin can view the current PIN

    // Earning configuration
    earningMode: { type: String, enum: Object.values(EARNING_MODES), default: EARNING_MODES.VISITS },
    amountPerPoint: { type: Number, default: 100, min: 1 }, // ₹ per 1 point, used when earningMode = bill_amount
    minBillAmount: { type: Number, default: 0, min: 0 }, // used when earningMode = visits_with_min_bill

    // Milestone ladder (used directly unless tiers are defined)
    milestones: { type: [milestoneSchema], default: [] },
    afterFinalMilestone: { type: String, enum: Object.values(AFTER_FINAL_MILESTONE), default: AFTER_FINAL_MILESTONE.RESET },
    tiers: { type: [tierSchema], default: [] }, // used when afterFinalMilestone = next_tier

    // Signup configuration
    headStart: {
      enabled: { type: Boolean, default: false },
      stamps: { type: Number, default: 0, min: 0 },
    },
    signupFields: {
      name: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      birthday: { type: Boolean, default: false },
    },
    birthdayReward: {
      enabled: { type: Boolean, default: false },
      rewardType: { type: String, enum: Object.values(REWARD_TYPES), default: REWARD_TYPES.CUSTOM },
      rewardValue: { type: String, default: "" },
      label: { type: String, default: "" },
    },

    // Check-in configuration
    checkInMode: { type: String, enum: Object.values(CHECK_IN_MODES), default: CHECK_IN_MODES.AUTOMATIC },
    billAmountFieldEnabled: { type: Boolean, default: false },
    stampLimitPerDay: { type: Number, default: 1, min: 1 },
    lapsedAfterDays: { type: Number, default: 30, min: 1 },

    // Branding
    branding: {
      primaryColor: { type: String, default: "#111827" },
      secondaryColor: { type: String, default: "#F59E0B" },
    },

    // Platform admin controls
    plan: { type: String, enum: Object.values(PLANS), default: PLANS.TRIAL },
    status: { type: String, enum: Object.values(BUSINESS_STATUS), default: BUSINESS_STATUS.ACTIVE },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

businessSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.owner.passwordHash);
};

businessSchema.methods.comparePin = function comparePin(candidate) {
  if (!this.pinHash) return Promise.resolve(false);
  return bcrypt.compare(String(candidate), this.pinHash);
};

businessSchema.statics.hash = function hash(plain) {
  return bcrypt.hash(String(plain), 10);
};

/**
 * Snapshot of the rules that apply to a customer's *current* card cycle.
 * Captured at signup and re-captured whenever a card resets / moves tiers,
 * so mid-card customers keep finishing on the rules that were active when
 * their card started, per BRD business rules.
 */
businessSchema.methods.buildRuleSnapshot = function buildRuleSnapshot(tierIndex = 0) {
  const usingTiers = this.afterFinalMilestone === AFTER_FINAL_MILESTONE.NEXT_TIER && this.tiers.length > 0;
  const activeTier = usingTiers ? this.tiers[Math.min(tierIndex, this.tiers.length - 1)] : null;

  return {
    earningMode: this.earningMode,
    amountPerPoint: this.amountPerPoint,
    minBillAmount: this.minBillAmount,
    afterFinalMilestone: this.afterFinalMilestone,
    usingTiers,
    tierIndex: usingTiers ? tierIndex : 0,
    tierName: activeTier ? activeTier.name : null,
    milestones: (usingTiers ? activeTier.milestones : this.milestones)
      .map((m) => ({ milestoneId: m._id, count: m.count, rewardType: m.rewardType, rewardValue: m.rewardValue, label: m.label }))
      .sort((a, b) => a.count - b.count),
  };
};

businessSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.owner?.passwordHash;
    delete ret.pinHash;
    delete ret.pinEncrypted;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Business", businessSchema);
