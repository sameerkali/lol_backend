const EARNING_MODES = Object.freeze({
  VISITS: "visits",
  BILL_AMOUNT: "bill_amount",
  VISITS_WITH_MIN_BILL: "visits_with_min_bill",
});

const REWARD_TYPES = Object.freeze({
  FREE_ITEM: "free_item",
  PERCENT_OFF: "percent_off",
  FLAT_OFF: "flat_off",
  CUSTOM: "custom",
});

const AFTER_FINAL_MILESTONE = Object.freeze({
  RESET: "reset",
  NEXT_TIER: "next_tier",
});

const CHECK_IN_MODES = Object.freeze({
  AUTOMATIC: "automatic",
  PIN: "pin",
});

const VISIT_TYPES = Object.freeze({
  VISIT: "visit",
  REDEMPTION: "redemption",
});

const VISIT_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
});

const BUSINESS_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

const PLANS = Object.freeze({
  TRIAL: "trial",
  BASIC: "basic",
  PRO: "pro",
});

module.exports = {
  EARNING_MODES,
  REWARD_TYPES,
  AFTER_FINAL_MILESTONE,
  CHECK_IN_MODES,
  VISIT_TYPES,
  VISIT_STATUS,
  BUSINESS_STATUS,
  PLANS,
};
