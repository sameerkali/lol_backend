const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok } = require("../utils/ApiResponse");
const Customer = require("../models/Customer");
const Visit = require("../models/Visit");
const { toCsv } = require("../utils/csv");

function todayMonthDay() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function buildFilter(business, query) {
  const filter = { business: business._id };
  if (query.phone) filter.phone = { $regex: query.phone, $options: "i" };
  if (query.minVisits) filter.totalVisits = { ...(filter.totalVisits || {}), $gte: Number(query.minVisits) };
  if (query.maxVisits) filter.totalVisits = { ...(filter.totalVisits || {}), $lte: Number(query.maxVisits) };
  if (query.hasUnredeemedRewards === "true") {
    filter.milestonesUnlocked = { $elemMatch: { redeemed: false } };
  }
  if (query.lastVisitBefore) filter.lastVisitAt = { ...(filter.lastVisitAt || {}), $lte: new Date(query.lastVisitBefore) };
  if (query.lastVisitAfter) filter.lastVisitAt = { ...(filter.lastVisitAt || {}), $gte: new Date(query.lastVisitAfter) };
  if (query.tier) filter["ruleSnapshot.tierName"] = query.tier;
  // dob is "YYYY-MM-DD" for new signups, but legacy customers only have a
  // plain "MM-DD" — both end with "MM-DD", so anchoring the regex to the end
  // matches today's month+day regardless of which shape is stored.
  if (query.dobToday === "true") filter.dob = { $regex: `${todayMonthDay()}$` };
  return filter;
}

const SORT_MAP = {
  lastVisit: { lastVisitAt: -1 },
  visits: { totalVisits: -1 },
  newest: { createdAt: -1 },
  tier: { "ruleSnapshot.tierIndex": -1, "ruleSnapshot.tierName": 1 },
};

// Reusable core: shared by the business self-service routes and the
// admin-scoped equivalents under /admin/businesses/:id/*, since both just
// need a resolved `business` document to scope the query.
async function listCustomersForBusiness(business, query) {
  const { page = 1, limit = 25, sort = "newest" } = query;
  const filter = buildFilter(business, query);
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Customer.find(filter)
      .sort(SORT_MAP[sort] || SORT_MAP.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Customer.countDocuments(filter),
  ]);

  return { items, meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } };
}

async function getCustomerDetailForBusiness(business, customerId) {
  const customer = await Customer.findOne({ _id: customerId, business: business._id });
  if (!customer) throw ApiError.notFound("Customer not found");

  const history = await Visit.find({ business: business._id, customer: customer._id }).sort({ createdAt: -1 });

  return {
    customer: {
      _id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      dob: customer.dob,
      totalVisits: customer.totalVisits,
      totalPoints: customer.totalPoints,
      lastVisitAt: customer.lastVisitAt,
      createdAt: customer.createdAt,
      ruleSnapshot: { tierName: customer.ruleSnapshot.tierName },
      rewards: customer.milestonesUnlocked.map((r) => ({
        _id: r._id,
        label: r.label,
        rewardType: r.rewardType,
        rewardValue: r.rewardValue,
        redeemedAt: r.redeemedAt,
      })),
      history: history.map((v) => ({
        _id: v._id,
        type: v.type,
        createdAt: v.createdAt,
        rewardType: v.rewardType,
        rewardValue: v.rewardValue,
      })),
    },
  };
}

async function buildCustomersCsv(business, query) {
  const filter = buildFilter(business, query);
  const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();

  const fields = ["phone"];
  if (business.signupFields.name) fields.push("name");
  if (business.signupFields.email) fields.push("email");
  if (business.signupFields.dob) fields.push("dob");
  fields.push("count", "cardCycle", "totalVisits", "totalPoints", "totalRedemptions", "lastVisitAt", "createdAt");

  const rows = customers.map((c) => ({
    phone: c.phone,
    name: c.name,
    email: c.email,
    dob: c.dob,
    count: c.count,
    cardCycle: c.cardCycle,
    totalVisits: c.totalVisits,
    totalPoints: c.totalPoints,
    totalRedemptions: c.totalRedemptions,
    lastVisitAt: c.lastVisitAt,
    createdAt: c.createdAt,
  }));

  return toCsv(rows, fields);
}

const listCustomers = asyncHandler(async (req, res) => {
  const { items, meta } = await listCustomersForBusiness(req.business, req.query);
  ok(res, items, meta);
});

const getCustomer = asyncHandler(async (req, res) => {
  const data = await getCustomerDetailForBusiness(req.business, req.params.id);
  ok(res, data);
});

const getCustomerHistory = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, business: req.business._id });
  if (!customer) throw ApiError.notFound("Customer not found");

  const history = await Visit.find({ business: req.business._id, customer: customer._id }).sort({ createdAt: -1 });
  ok(res, history);
});

const exportCustomers = asyncHandler(async (req, res) => {
  const csv = await buildCustomersCsv(req.business, req.query);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${req.business.slug}-customers.csv"`);
  res.send(csv);
});

module.exports = {
  listCustomers,
  getCustomer,
  getCustomerHistory,
  exportCustomers,
  // shared with admin.business.controller.js for the admin-scoped routes
  listCustomersForBusiness,
  getCustomerDetailForBusiness,
  buildCustomersCsv,
};
