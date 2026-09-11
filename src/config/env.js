const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Browsers never send a trailing slash in the `Origin` header, so a
// CORS allowlist entry with one (e.g. "https://example.com/" from a
// copy-pasted URL) would silently never match. Strip it defensively.
const stripTrailingSlash = (url) => url.trim().replace(/\/+$/, "");

// FRONTEND_URL may be a single origin or a comma-separated list (e.g. apex +
// www, or a staging domain alongside production).
function parseAllowedOrigins(value) {
  return value
    .split(",")
    .map((origin) => stripTrailingSlash(origin))
    .filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: required("MONGODB_URI"),
  mongoDbName: process.env.MONGODB_DB_NAME || "loyalty",
  frontendUrl: stripTrailingSlash(process.env.FRONTEND_URL || "http://localhost:3000"),
  allowedOrigins: parseAllowedOrigins(process.env.FRONTEND_URL || "http://localhost:3000"),
  apiBaseUrl: stripTrailingSlash(
    process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT) || 5000}`
  ),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  pinEncryptionKey: process.env.PIN_ENCRYPTION_KEY || null,
  admin: {
    name: process.env.ADMIN_NAME || "Expendifii Admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  isProd: (process.env.NODE_ENV || "development") === "production",
};

module.exports = env;
