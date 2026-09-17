const express = require("express");
const { body, param } = require("express-validator");
const validate = require("../middleware/validate");
const { pinLimiter } = require("../middleware/rateLimit");
const publicController = require("../controllers/public.controller");

const router = express.Router();

const slugParam = param("slug").notEmpty();
const phoneBody = body("phone").notEmpty().isLength({ min: 6, max: 20 });

// India-only 10-digit mobile numbers, first digit 6-9 — stricter than the
// generic phoneBody above since this is the point of entry where a customer
// record (and its phone number) is actually created.
const signupPhoneBody = body("phone").matches(/^[6-9]\d{9}$/);
const signupEmailBody = body("email").optional({ checkFalsy: true }).isEmail();
const signupDobBody = body("dob")
  .optional({ checkFalsy: true })
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const dob = new Date(Date.UTC(year, month - 1, day));
    const isRealDate = dob.getUTCFullYear() === year && dob.getUTCMonth() === month - 1 && dob.getUTCDate() === day;
    if (!isRealDate) throw new Error("dob must be a real calendar date");

    const now = new Date();
    const hadBirthdayThisYear =
      now.getUTCMonth() > month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() >= day);
    const age = now.getUTCFullYear() - year - (hadBirthdayThisYear ? 0 : 1);
    if (age < 8 || age > 90) throw new Error("dob must correspond to an age between 8 and 90 years");
    return true;
  });

router.get("/businesses/:slug", slugParam, validate, publicController.getBusiness);

router.post("/businesses/:slug/lookup", slugParam, phoneBody, validate, publicController.lookupCustomer);

router.post(
  "/businesses/:slug/signup",
  slugParam,
  signupPhoneBody,
  signupEmailBody,
  signupDobBody,
  validate,
  publicController.signup
);

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
