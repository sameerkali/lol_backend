const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok } = require("../utils/ApiResponse");
const Business = require("../models/Business");
const generateToken = require("../utils/generateToken");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const business = await Business.findOne({ "owner.email": String(email).toLowerCase() });
  if (!business) throw ApiError.unauthorized("Invalid email or password");

  const valid = await business.comparePassword(password);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");
  if (business.status !== "active") throw ApiError.forbidden("This business account is inactive");

  const token = generateToken({ sub: business._id.toString(), role: "business" });
  ok(res, { token, business });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw ApiError.badRequest("currentPassword and newPassword are required");

  const valid = await req.business.comparePassword(currentPassword);
  if (!valid) throw ApiError.unauthorized("Current password is incorrect");

  req.business.owner.passwordHash = await Business.hash(newPassword);
  await req.business.save();
  ok(res, { updated: true });
});

module.exports = { login, changePassword };
