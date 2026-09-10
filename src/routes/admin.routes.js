const express = require("express");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const { uploadLogo } = require("../middleware/upload");
const authController = require("../controllers/admin.auth.controller");
const businessController = require("../controllers/admin.business.controller");

const router = express.Router();

// Auth
router.post(
  "/auth/login",
  authLimiter,
  [body("email").isEmail(), body("password").notEmpty()],
  validate,
  authController.login
);
router.get("/auth/me", requireAdmin, authController.me);
router.post(
  "/auth/admins",
  requireAdmin,
  [body("name").notEmpty(), body("email").isEmail(), body("password").isLength({ min: 8 })],
  validate,
  authController.createAdmin
);

// Templates
router.get("/templates", requireAdmin, businessController.templates);

// Platform stats
router.get("/stats", requireAdmin, businessController.stats);

// Businesses
router.get("/businesses", requireAdmin, businessController.listBusinesses);
router.post(
  "/businesses",
  requireAdmin,
  uploadLogo,
  [body("name").notEmpty(), body("ownerEmail").isEmail(), body("ownerPassword").isLength({ min: 8 })],
  validate,
  businessController.createBusiness
);
router.get("/businesses/:id", requireAdmin, businessController.getBusiness);
router.put("/businesses/:id", requireAdmin, uploadLogo, businessController.updateBusiness);
router.patch("/businesses/:id/plan", requireAdmin, businessController.patchPlan);
router.patch("/businesses/:id/status", requireAdmin, businessController.patchStatus);
router.delete("/businesses/:id", requireAdmin, businessController.deleteBusiness);
router.get("/businesses/:id/qr", requireAdmin, businessController.getBusinessQr);

module.exports = router;
