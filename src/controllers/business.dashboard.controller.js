const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/ApiResponse");
const { businessDashboard } = require("../services/stats.service");

const getDashboard = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await businessDashboard(req.business._id, req.business, { from, to });
  ok(res, data);
});

module.exports = { getDashboard };
