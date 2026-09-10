const slugify = require("slugify");

function baseSlug(name) {
  return slugify(name, { lower: true, strict: true, trim: true }).slice(0, 60) || "business";
}

function randomSuffix(length = 4) {
  return Math.random().toString(36).slice(2, 2 + length);
}

module.exports = { baseSlug, randomSuffix };
