const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const env = require("./config/env");
const connectDB = require("./config/db");
const routes = require("./routes");
const sanitize = require("./middleware/sanitize");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimit");
const ApiError = require("./utils/ApiError");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = not a browser cross-origin request (curl, server-to-server,
      // same-origin) — nothing for CORS to enforce, so allow it through.
      if (!origin || env.allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      callback(ApiError.forbidden(`CORS: origin "${origin}" is not allowed`));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(morgan(env.isProd ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);

// On a serverless platform (Vercel) there is no long-lived startup phase, so
// each cold invocation must ensure the DB is connected before hitting a
// route; connectDB() caches the connection, so a warm invocation is a no-op.
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use("/api", apiLimiter, routes);

// Root health check — used by Vercel and uptime monitors, so it must not touch the DB.
app.get("/", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    message: "Expendifii Loyalty API",
    baseUrl: env.apiBaseUrl,
    docs: "/api.md",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
