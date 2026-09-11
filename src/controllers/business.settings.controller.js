const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok } = require("../utils/ApiResponse");
const Business = require("../models/Business");
const { generateQrDataUrl, generateQrBuffer } = require("../services/qr.service");
const { encryptPin, decryptPin } = require("../utils/pinCipher");

// The business's own view of itself additionally carries the plaintext PIN
// (decrypted from pinEncrypted) so the owner can see it on the dashboard —
// toJSON() strips pinHash/pinEncrypted for every other consumer.
function withPin(business) {
  const json = business.toJSON();
  json.pin = decryptPin(business.pinEncrypted);
  return json;
}

const EDITABLE_FIELDS = [
  "name",
  "earningMode",
  "amountPerPoint",
  "minBillAmount",
  "milestones",
  "afterFinalMilestone",
  "tiers",
  "headStart",
  "signupFields",
  "birthdayReward",
  "checkInMode",
  "billAmountFieldEnabled",
  "stampLimitPerDay",
  "lapsedAfterDays",
];

const getMe = asyncHandler(async (req, res) => {
  ok(res, withPin(req.business));
});

const updateMe = asyncHandler(async (req, res) => {
  const business = req.business;
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) business[field] = req.body[field];
  }
  await business.save();
  ok(res, withPin(business));
});

const updatePin = asyncHandler(async (req, res) => {
  const { pin, currentPin } = req.body;
  if (!pin || !/^\d{4,6}$/.test(String(pin))) throw ApiError.badRequest("pin must be 4-6 digits");

  if (req.business.pinHash) {
    if (!currentPin) throw ApiError.badRequest("currentPin is required to change an existing PIN");
    const valid = await req.business.comparePin(currentPin);
    if (!valid) throw ApiError.unauthorized("Current PIN is incorrect");
  }

  req.business.pinHash = await Business.hash(pin);
  req.business.pinEncrypted = encryptPin(pin);
  await req.business.save();
  ok(res, { updated: true, pin });
});

const updateBranding = asyncHandler(async (req, res) => {
  const { primaryColor, secondaryColor } = req.body;
  if (primaryColor) req.business.branding.primaryColor = primaryColor;
  if (secondaryColor) req.business.branding.secondaryColor = secondaryColor;

  await req.business.save();
  ok(res, req.business.branding);
});

const getQr = asyncHandler(async (req, res) => {
  const { link, dataUrl } = await generateQrDataUrl(req.business.slug);
  ok(res, { link, qrCodeDataUrl: dataUrl, nfcLink: link });
});

const downloadQr = asyncHandler(async (req, res) => {
  const { buffer } = await generateQrBuffer(req.business.slug);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", `attachment; filename="${req.business.slug}-qr.png"`);
  res.send(buffer);
});

module.exports = { getMe, updateMe, updatePin, updateBranding, getQr, downloadQr };
