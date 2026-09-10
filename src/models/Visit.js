const mongoose = require("mongoose");
const { VISIT_TYPES, CHECK_IN_MODES } = require("../constants/loyalty");

const visitSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    type: { type: String, enum: Object.values(VISIT_TYPES), required: true },

    // visit-specific
    billAmount: { type: Number, default: null },
    pointsEarned: { type: Number, default: 0 },
    stampAwarded: { type: Boolean, default: false },
    confirmedBy: { type: String, enum: Object.values(CHECK_IN_MODES), default: CHECK_IN_MODES.AUTOMATIC },
    countAfter: { type: Number, default: null },
    milestonesReached: { type: [Number], default: [] }, // milestone counts reached by this visit

    // redemption-specific
    milestoneUnlockedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    rewardLabel: { type: String, default: "" },
    rewardType: { type: String, default: "" },
    rewardValue: { type: String, default: "" },

    note: { type: String, default: "" },
  },
  { timestamps: true }
);

visitSchema.index({ business: 1, createdAt: -1 });
visitSchema.index({ business: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Visit", visitSchema);
