const jwt = require("jsonwebtoken");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Admin = require("../models/Admin");
const Business = require("../models/Business");
const { BUSINESS_STATUS } = require("../constants/loyalty");

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  if (payload.role !== "admin") throw ApiError.forbidden("Admin access required");

  const admin = await Admin.findById(payload.sub);
  if (!admin) throw ApiError.unauthorized("Admin no longer exists");

  req.admin = admin;
  next();
});

const requireBusiness = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  if (payload.role !== "business") throw ApiError.forbidden("Business access required");

  const business = await Business.findById(payload.sub);
  if (!business) throw ApiError.unauthorized("Business no longer exists");
  if (business.status !== BUSINESS_STATUS.ACTIVE) throw ApiError.forbidden("Business account is inactive");

  req.business = business;
  next();
});

module.exports = { requireAdmin, requireBusiness };
