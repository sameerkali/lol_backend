const { Parser } = require("json2csv");

function toCsv(rows, fields) {
  const parser = new Parser({ fields });
  return parser.parse(rows);
}

module.exports = { toCsv };
