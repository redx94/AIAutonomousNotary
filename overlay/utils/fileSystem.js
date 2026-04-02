const fs = require("fs");
const path = require("path");

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
}

function writeJson(targetPath, payload) {
  ensureDirectory(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
  return targetPath;
}

module.exports = {
  ensureDirectory,
  writeJson,
};
