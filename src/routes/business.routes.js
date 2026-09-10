const express = require("express");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { requireBusiness } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const { uploadLogo } = require("../middleware/upload");
const authController = require("../controllers/business.auth.controller");
const settingsController = require("../controllers/business.settings.controller");
const customersController = require("../controllers/business.customers.controller");
const dashboardController = require("../controllers/business.dashboard.controller");

const router = express.Router();

// Auth
router.post(
  "/auth/login",
  authLimiter,
  [body("email").isEmail(), body("password").notEmpty()],
  validate,
  authController.login
);
router.post(
  "/auth/change-password",
  requireBusiness,
  [body("currentPassword").notEmpty(), body("newPassword").isLength({ min: 8 })],
  validate,
  authController.changePassword
);

// Settings
router.get("/me", requireBusiness, settingsController.getMe);
router.put("/me", requireBusiness, settingsController.updateMe);
router.put(
  "/me/pin",
  requireBusiness,
  [body("pin").matches(/^\d{4,6}$/)],
  validate,
  settingsController.updatePin
);
router.put("/me/branding", requireBusiness, uploadLogo, settingsController.updateBranding);
router.get("/me/qr", requireBusiness, settingsController.getQr);
router.get("/me/qr/download", requireBusiness, settingsController.downloadQr);

// Dashboard
router.get("/dashboard", requireBusiness, dashboardController.getDashboard);

// Customers
router.get("/customers", requireBusiness, customersController.listCustomers);
router.get("/customers/export", requireBusiness, customersController.exportCustomers);
router.get("/customers/:id", requireBusiness, customersController.getCustomer);
router.get("/customers/:id/history", requireBusiness, customersController.getCustomerHistory);

module.exports = router;
