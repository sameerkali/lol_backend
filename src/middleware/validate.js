const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw ApiError.badRequest("Validation failed", result.array().map((e) => ({ field: e.path, message: e.msg })));
  }
  next();
}

module.exports = validate;
