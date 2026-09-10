const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB, per BRD
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(__dirname, "../../uploads/logos")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Logo must be PNG, JPG, WEBP or SVG"));
  }
  cb(null, true);
}

const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_LOGO_BYTES },
}).single("logo");

module.exports = { uploadLogo, MAX_LOGO_BYTES };
