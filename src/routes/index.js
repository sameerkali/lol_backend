const express = require("express");
const adminRoutes = require("./admin.routes");
const businessRoutes = require("./business.routes");
const publicRoutes = require("./public.routes");

const router = express.Router();

router.get("/health", (req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));

router.use("/admin", adminRoutes);
router.use("/business", businessRoutes);
router.use("/public", publicRoutes);

module.exports = router;
