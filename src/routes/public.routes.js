const express = require("express");
const { body, param } = require("express-validator");
const validate = require("../middleware/validate");
const { pinLimiter } = require("../middleware/rateLimit");
const publicController = require("../controllers/public.controller");

const router = express.Router();

const slugParam = param("slug").notEmpty();
const phoneBody = body("phone").notEmpty().isLength({ min: 6, max: 20 });

router.get("/businesses/:slug", slugParam, validate, publicController.getBusiness);

router.post("/businesses/:slug/lookup", slugParam, phoneBody, validate, publicController.lookupCustomer);

router.post("/businesses/:slug/signup", slugParam, phoneBody, validate, publicController.signup);

router.get(
  "/businesses/:slug/card/:phone",
  slugParam,
  param("phone").notEmpty(),
  validate,
  publicController.getCard
);

router.get(
  "/businesses/:slug/history/:phone",
  slugParam,
  param("phone").notEmpty(),
  validate,
  publicController.getHistory
);

router.post(
  "/businesses/:slug/visits",
  pinLimiter,
  slugParam,
  phoneBody,
  validate,
  publicController.markVisit
);

router.post(
  "/businesses/:slug/redeem",
  pinLimiter,
  slugParam,
  phoneBody,
  body("milestoneUnlockedId").notEmpty(),
  validate,
  publicController.redeem
);

module.exports = router;
