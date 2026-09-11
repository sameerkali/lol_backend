const crypto = require("crypto");
const env = require("../config/env");

// The business PIN is a 4-6 digit code known to counter staff and re-entered
// on every visit/redemption — it is operational, not a customer secret like a
// password. Business owners and admins need to be able to *see* it (BRD:
// "Business PIN: set and change" surfaced on the dashboard), so alongside the
// bcrypt hash used for verification we keep a reversible AES-256-GCM copy.
const ALGORITHM = "aes-256-gcm";

function getKey() {
  // Derive a stable 32-byte key from PIN_ENCRYPTION_KEY (or fall back to
  // JWT_SECRET so existing deployments don't need a new env var to boot).
  const secret = env.pinEncryptionKey || env.jwtSecret;
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptPin(plainPin) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainPin), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptPin(payload) {
  if (!payload) return null;
  try {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

module.exports = { encryptPin, decryptPin };
