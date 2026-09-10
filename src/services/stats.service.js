const Customer = require("../models/Customer");
const Visit = require("../models/Visit");
const Business = require("../models/Business");
const { VISIT_TYPES } = require("../constants/loyalty");

function resolveRange({ from, to }) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

async function businessDashboard(businessId, business, range) {
  const { start, end } = resolveRange(range);
  const matchDate = { createdAt: { $gte: start, $lte: end } };

  const [signups, visitsInRange, redemptionsInRange, totalCustomers, repeatCustomers, lapsedCustomers, visitsByDay] =
    await Promise.all([
      Customer.countDocuments({ business: businessId, ...matchDate }),
      Visit.countDocuments({ business: businessId, type: VISIT_TYPES.VISIT, ...matchDate }),
      Visit.countDocuments({ business: businessId, type: VISIT_TYPES.REDEMPTION, ...matchDate }),
      Customer.countDocuments({ business: businessId }),
      Customer.countDocuments({ business: businessId, totalVisits: { $gte: 2 } }),
      Customer.countDocuments({
        business: businessId,
        lastVisitAt: { $lt: new Date(Date.now() - business.lapsedAfterDays * 24 * 60 * 60 * 1000) },
      }),
      Visit.aggregate([
        { $match: { business: business._id, type: VISIT_TYPES.VISIT, ...matchDate } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const repeatVisitRate = totalCustomers > 0 ? Number(((repeatCustomers / totalCustomers) * 100).toFixed(1)) : 0;

  return {
    range: { from: start, to: end },
    signups,
    visits: visitsInRange,
    redemptions: redemptionsInRange,
    totalCustomers,
    repeatCustomers,
    repeatVisitRate,
    lapsedCustomers,
    lapsedAfterDays: business.lapsedAfterDays,
    visitsByDay: visitsByDay.map((v) => ({ date: v._id, count: v.count })),
  };
}

async function platformStats() {
  const [totalBusinesses, activeBusinesses, totalCustomers, totalVisits, totalRedemptions, byPlan] = await Promise.all([
    Business.countDocuments({}),
    Business.countDocuments({ status: "active" }),
    Customer.countDocuments({}),
    Visit.countDocuments({ type: VISIT_TYPES.VISIT }),
    Visit.countDocuments({ type: VISIT_TYPES.REDEMPTION }),
    Business.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
  ]);

  return {
    totalBusinesses,
    activeBusinesses,
    inactiveBusinesses: totalBusinesses - activeBusinesses,
    totalCustomers,
    totalVisits,
    totalRedemptions,
    businessesByPlan: byPlan.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {}),
  };
}

module.exports = { businessDashboard, platformStats, resolveRange };
