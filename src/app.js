const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const env = require("./config/env");
const routes = require("./routes");
const sanitize = require("./middleware/sanitize");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimit");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(compression());
app.use(morgan(env.isProd ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use("/api", apiLimiter, routes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "Expendifii Loyalty API", docs: "/api.md" });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
