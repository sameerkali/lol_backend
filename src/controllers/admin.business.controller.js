const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok, created } = require("../utils/ApiResponse");
const Business = require("../models/Business");
const Customer = require("../models/Customer");
const Visit = require("../models/Visit");
const { getTemplate, listTemplates } = require("../constants/templates");
const { baseSlug, randomSuffix } = require("../utils/slug");
const { generateQrDataUrl } = require("../services/qr.service");
const { platformStats } = require("../services/stats.service");
const { encryptPin, decryptPin } = require("../utils/pinCipher");
const { PLANS, BUSINESS_STATUS } = require("../constants/loyalty");

// Admin has full override power per BRD, including seeing the current PIN —
// surfaced only on single-business reads/writes, not the list view.
function withPin(business) {
  const json = business.toJSON();
  json.pin = decryptPin(business.pinEncrypted);
  return json;
}

async function uniqueSlug(name) {
  const base = baseSlug(name);
  let slug = base;
  // eslint-disable-next-line no-await-in-loop
  while (await Business.exists({ slug })) {
    slug = `${base}-${randomSuffix()}`;
  }
  return slug;
}

const templates = asyncHandler(async (req, res) => {
  ok(res, listTemplates());
});

const createBusiness = asyncHandler(async (req, res) => {
  const { name, template, ownerEmail, ownerPassword, pin, plan, overrides } = req.body;

  if (!name || !ownerEmail || !ownerPassword) {
    throw ApiError.badRequest("name, ownerEmail and ownerPassword are required");
  }
  if (pin && !/^\d{4,6}$/.test(String(pin))) throw ApiError.badRequest("pin must be 4-6 digits");

  const existingOwner = await Business.findOne({ "owner.email": String(ownerEmail).toLowerCase() });
  if (existingOwner) throw ApiError.conflict("A business with this owner email already exists");

  const { defaults } = getTemplate(template);
  const parsedOverrides = typeof overrides === "string" ? JSON.parse(overrides) : overrides || {};

  const slug = await uniqueSlug(name);
  const ownerPasswordHash = await Business.hash(ownerPassword);
  const pinHash = pin ? await Business.hash(pin) : null;
  const pinEncrypted = pin ? encryptPin(pin) : null;

  const business = new Business({
    name,
    slug,
    template: template || "blank",
    owner: { email: String(ownerEmail).toLowerCase(), passwordHash: ownerPasswordHash },
    pinHash,
    pinEncrypted,
    plan: plan || "trial",
    createdBy: req.admin._id,
    ...defaults,
    ...parsedOverrides,
  });

  await business.save();
  created(res, withPin(business));
});

const listBusinesses = asyncHandler(async (req, res) => {
  const { search, status, plan, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
      { "owner.email": { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.status = status;
  if (plan) filter.plan = plan;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Business.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Business.countDocuments(filter),
  ]);

  ok(res, items, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) });
});

const getBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) throw ApiError.notFound("Business not found");
  ok(res, withPin(business));
});

// Admin override: can update any field on the business, including settings
// normally only the owner controls, per BRD "View and override any
// business's settings".
const updateBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) throw ApiError.notFound("Business not found");

  const { ownerPassword, pin, name, ...rest } = req.body;
  Object.assign(business, rest);
  if (name) business.name = name;
  if (ownerPassword) business.owner.passwordHash = await Business.hash(ownerPassword);
  if (pin) {
    if (!/^\d{4,6}$/.test(String(pin))) throw ApiError.badRequest("pin must be 4-6 digits");
    business.pinHash = await Business.hash(pin);
    business.pinEncrypted = encryptPin(pin);
  }

  await business.save();
  ok(res, withPin(business));
});

const patchPlan = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  if (!plan) throw ApiError.badRequest("plan is required");
  if (!Object.values(PLANS).includes(plan)) throw ApiError.badRequest(`plan must be one of: ${Object.values(PLANS).join(", ")}`);
  const business = await Business.findByIdAndUpdate(req.params.id, { plan }, { new: true });
  if (!business) throw ApiError.notFound("Business not found");
  ok(res, business);
});

const patchStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) throw ApiError.badRequest("status is required");
  if (!Object.values(BUSINESS_STATUS).includes(status)) throw ApiError.badRequest(`status must be one of: ${Object.values(BUSINESS_STATUS).join(", ")}`);
  const business = await Business.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!business) throw ApiError.notFound("Business not found");
  ok(res, business);
});

const deleteBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findByIdAndDelete(req.params.id);
  if (!business) throw ApiError.notFound("Business not found");

  // Cascade: a business's customers and visit logs are meaningless without it.
  await Promise.all([Customer.deleteMany({ business: business._id }), Visit.deleteMany({ business: business._id })]);

  ok(res, { deleted: true });
});

const getBusinessQr = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) throw ApiError.notFound("Business not found");
  const { link, dataUrl } = await generateQrDataUrl(business.slug);
  ok(res, { link, qrCodeDataUrl: dataUrl, nfcLink: link });
});

const stats = asyncHandler(async (req, res) => {
  const data = await platformStats();
  ok(res, data);
});

module.exports = {
  templates,
  createBusiness,
  listBusinesses,
  getBusiness,
  updateBusiness,
  patchPlan,
  patchStatus,
  deleteBusiness,
  getBusinessQr,
  stats,
};
