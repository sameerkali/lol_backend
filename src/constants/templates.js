const { EARNING_MODES, REWARD_TYPES, AFTER_FINAL_MILESTONE, CHECK_IN_MODES } = require("./loyalty");

// Starting points an owner can tweak after picking a template at business setup.
const TEMPLATES = {
  cafe: {
    key: "cafe",
    label: "Café",
    description: "Simple visit-based punch card. Great for coffee shops and quick-service spots.",
    defaults: {
      earningMode: EARNING_MODES.VISITS,
      amountPerPoint: 100,
      minBillAmount: 0,
      checkInMode: CHECK_IN_MODES.AUTOMATIC,
      billAmountFieldEnabled: false,
      stampLimitPerDay: 1,
      headStart: { enabled: false, stamps: 0 },
      signupFields: { name: true, email: false, birthday: false },
      birthdayReward: { enabled: false, rewardType: REWARD_TYPES.CUSTOM, rewardValue: "", label: "" },
      afterFinalMilestone: AFTER_FINAL_MILESTONE.RESET,
      milestones: [
        { count: 5, rewardType: REWARD_TYPES.FREE_ITEM, rewardValue: "Free coffee", label: "5 visits" },
        { count: 10, rewardType: REWARD_TYPES.PERCENT_OFF, rewardValue: "20", label: "10 visits" },
      ],
      tiers: [],
    },
  },
  restaurant: {
    key: "restaurant",
    label: "Restaurant",
    description: "Points scale with the bill, rewarding bigger spenders faster.",
    defaults: {
      earningMode: EARNING_MODES.BILL_AMOUNT,
      amountPerPoint: 200,
      minBillAmount: 0,
      checkInMode: CHECK_IN_MODES.PIN,
      billAmountFieldEnabled: true,
      stampLimitPerDay: 1,
      headStart: { enabled: true, stamps: 1 },
      signupFields: { name: true, email: true, birthday: true },
      birthdayReward: { enabled: true, rewardType: REWARD_TYPES.PERCENT_OFF, rewardValue: "15", label: "Birthday treat" },
      afterFinalMilestone: AFTER_FINAL_MILESTONE.NEXT_TIER,
      milestones: [
        { count: 5, rewardType: REWARD_TYPES.FLAT_OFF, rewardValue: "100", label: "5 points" },
        { count: 12, rewardType: REWARD_TYPES.PERCENT_OFF, rewardValue: "25", label: "12 points" },
      ],
      tiers: [
        {
          name: "Silver",
          milestones: [
            { count: 5, rewardType: REWARD_TYPES.FLAT_OFF, rewardValue: "100", label: "5 points" },
            { count: 12, rewardType: REWARD_TYPES.PERCENT_OFF, rewardValue: "25", label: "12 points" },
          ],
        },
        {
          name: "Gold",
          milestones: [
            { count: 8, rewardType: REWARD_TYPES.FLAT_OFF, rewardValue: "200", label: "8 points" },
            { count: 20, rewardType: REWARD_TYPES.CUSTOM, rewardValue: "Chef's tasting menu", label: "20 points" },
          ],
        },
      ],
    },
  },
  blank: {
    key: "blank",
    label: "Blank / custom",
    description: "Start from minimal defaults and configure everything yourself.",
    defaults: {
      earningMode: EARNING_MODES.VISITS,
      amountPerPoint: 100,
      minBillAmount: 0,
      checkInMode: CHECK_IN_MODES.AUTOMATIC,
      billAmountFieldEnabled: false,
      stampLimitPerDay: 1,
      headStart: { enabled: false, stamps: 0 },
      signupFields: { name: false, email: false, birthday: false },
      birthdayReward: { enabled: false, rewardType: REWARD_TYPES.CUSTOM, rewardValue: "", label: "" },
      afterFinalMilestone: AFTER_FINAL_MILESTONE.RESET,
      milestones: [{ count: 10, rewardType: REWARD_TYPES.CUSTOM, rewardValue: "Free reward", label: "10 visits" }],
      tiers: [],
    },
  },
};

function getTemplate(key) {
  return TEMPLATES[key] || TEMPLATES.blank;
}

function listTemplates() {
  return Object.values(TEMPLATES).map(({ key, label, description }) => ({ key, label, description }));
}

module.exports = { TEMPLATES, getTemplate, listTemplates };
