const path = require("path");
const defaults = require("./defaults");
const { validateConfig } = require("./schema");

function loadConfig(overrides = {}, env = process.env) {
  const merged = {
    ...defaults,
    ...Object.keys(defaults).reduce((accumulator, key) => {
      if (env[key] !== undefined) {
        accumulator[key] = env[key];
      }
      return accumulator;
    }, {}),
    ...overrides,
  };

  const validated = validateConfig(merged);
  return {
    ...validated,
    EVIDENCE_OUTPUT_DIR: path.resolve(process.cwd(), validated.EVIDENCE_OUTPUT_DIR),
  };
}

module.exports = loadConfig;
