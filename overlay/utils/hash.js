const crypto = require("crypto");

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashJson(value) {
  return hashValue(JSON.stringify(value, null, 2));
}

module.exports = {
  hashJson,
  hashValue,
};
