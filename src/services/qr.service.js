const QRCode = require("qrcode");
const env = require("../config/env");

function customerPageUrl(slug) {
  return `${env.frontendUrl.replace(/\/$/, "")}/b/${slug}`;
}

async function generateQrDataUrl(slug) {
  const link = customerPageUrl(slug);
  const dataUrl = await QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 2, width: 512 });
  return { link, dataUrl };
}

async function generateQrBuffer(slug) {
  const link = customerPageUrl(slug);
  const buffer = await QRCode.toBuffer(link, { errorCorrectionLevel: "M", margin: 2, width: 1024 });
  return { link, buffer };
}

module.exports = { customerPageUrl, generateQrDataUrl, generateQrBuffer };
