// Express 5 makes req.query a getter-only property, which breaks
// express-mongo-sanitize (it tries to reassign req.query wholesale).
// This does the same job — stripping keys that could be interpreted as
// Mongo operators or dotted paths — by mutating objects in place instead.
function sanitizeInPlace(value) {
  if (Array.isArray(value)) {
    value.forEach(sanitizeInPlace);
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete value[key];
        continue;
      }
      sanitizeInPlace(value[key]);
    }
  }
  return value;
}

function sanitize(req, res, next) {
  if (req.body) sanitizeInPlace(req.body);
  if (req.params) sanitizeInPlace(req.params);
  if (req.query) sanitizeInPlace(req.query);
  next();
}

module.exports = sanitize;
