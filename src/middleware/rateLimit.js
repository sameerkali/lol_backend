const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Generous general limiter for all API traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limiter for login endpoints, to slow down credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later." },
});

// Tight limiter for PIN entry (visit confirmation / redemption), a 4-6 digit
// secret that must be protected from brute forcing over the public endpoints.
const pinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.params.slug || ""}`,
  message: { success: false, message: "Too many attempts. Please wait a few minutes and try again." },
});

module.exports = { apiLimiter, authLimiter, pinLimiter };
