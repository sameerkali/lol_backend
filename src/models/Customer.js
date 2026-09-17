const mongoose = require("mongoose");
const { REWARD_TYPES } = require("../constants/loyalty");

const unlockedRewardSchema = new mongoose.Schema(
  {
    milestoneId: { type: mongoose.Schema.Types.ObjectId, default: null },
    count: { type: Number, required: true },
    cardCycle: { type: Number, required: true, default: 0 },
    tierName: { type: String, default: null },
    label: { type: String, default: "" },
    rewardType: { type: String, enum: Object.values(REWARD_TYPES), required: true },
    rewardValue: { type: String, default: "" },
    unlockedAt: { type: Date, default: Date.now },
    redeemed: { type: Boolean, default: false },
    redeemedAt: { type: Date, default: null },
  },
  { _id: true }
);

const ruleSnapshotMilestoneSchema = new mongoose.Schema(
  {
    milestoneId: { type: mongoose.Schema.Types.ObjectId },
    count: Number,
    rewardType: { type: String, enum: Object.values(REWARD_TYPES) },
    rewardValue: String,
    label: String,
  },
  { _id: false }
);

const ruleSnapshotSchema = new mongoose.Schema(
  {
    earningMode: String,
    amountPerPoint: Number,
    minBillAmount: Number,
    afterFinalMilestone: String,
    usingTiers: { type: Boolean, default: false },
    tierIndex: { type: Number, default: 0 },
    tierName: { type: String, default: null },
    milestones: { type: [ruleSnapshotMilestoneSchema], default: [] },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    phone: { type: String, required: true, trim: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    dob: { type: String, default: null }, // "YYYY-MM-DD"; legacy customers may still hold a plain "MM-DD"

    ruleSnapshot: { type: ruleSnapshotSchema, required: true },

    cardCycle: { type: Number, default: 0 }, // increments on reset / tier advance
    count: { type: Number, default: 0 }, // progress within the current card

    totalVisits: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    totalRedemptions: { type: Number, default: 0 },

    milestonesUnlocked: { type: [unlockedRewardSchema], default: [] },

    lastVisitAt: { type: Date, default: null },
    lastVisitDateKey: { type: String, default: null }, // YYYY-MM-DD in server TZ, for the daily stamp limit
    visitsToday: { type: Number, default: 0 },
  },
  { timestamps: true }
);

customerSchema.index({ business: 1, phone: 1 }, { unique: true });
customerSchema.index({ business: 1, lastVisitAt: -1 });

module.exports = mongoose.model("Customer", customerSchema);
