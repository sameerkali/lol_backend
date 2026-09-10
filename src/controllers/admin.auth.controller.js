const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok, created } = require("../utils/ApiResponse");
const Admin = require("../models/Admin");
const generateToken = require("../utils/generateToken");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email: String(email).toLowerCase() });
  if (!admin) throw ApiError.unauthorized("Invalid email or password");

  const valid = await admin.comparePassword(password);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const token = generateToken({ sub: admin._id.toString(), role: "admin" });
  ok(res, { token, admin });
});

const me = asyncHandler(async (req, res) => {
  ok(res, req.admin);
});

// Creating additional admins is itself an admin-only action (no public signup).
const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await Admin.findOne({ email: String(email).toLowerCase() });
  if (existing) throw ApiError.conflict("An admin with this email already exists");

  const passwordHash = await Admin.hashPassword(password);
  const admin = await Admin.create({ name, email: String(email).toLowerCase(), passwordHash });
  created(res, admin);
});

module.exports = { login, me, createAdmin };
