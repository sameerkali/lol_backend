const ApiError = require("../utils/ApiError");
const env = require("../config/env");

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.isApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }

  if (err && err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate value", details: err.keyValue });
  }

  console.error(err);
  const status = err instanceof ApiError ? err.statusCode : 500;
  res.status(status).json({
    success: false,
    message: err?.message || "Internal server error",
    stack: env.isProd ? undefined : err?.stack,
  });
}

module.exports = { notFoundHandler, errorHandler };
