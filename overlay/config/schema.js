const defaults = require("./defaults");
const { ValidationError, validateBoolean, validateEnum, validateString } = require("../utils/validation");

const LEGAL_MODES = ["compliant", "experimental"];
const AUTHORITY_PROVIDERS = ["human_commissioned", "autonomous"];
const PUBLICATION_MODES = ["disabled", "best_effort", "required_for_protocol_sync"];

function normalizeBoolean(value, key) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }

  throw new ValidationError(`${key} must be a boolean literal`);
}

function validateConfig(rawConfig) {
  const config = {
    LEGAL_MODE: validateEnum(rawConfig.LEGAL_MODE, "LEGAL_MODE", LEGAL_MODES),
    AUTHORITY_PROVIDER: validateEnum(
      rawConfig.AUTHORITY_PROVIDER,
      "AUTHORITY_PROVIDER",
      AUTHORITY_PROVIDERS
    ),
    ALLOW_AUTONOMOUS_EXECUTION: normalizeBoolean(
      rawConfig.ALLOW_AUTONOMOUS_EXECUTION,
      "ALLOW_AUTONOMOUS_EXECUTION"
    ),
    REQUIRE_HUMAN_FINAL_SIGNOFF: normalizeBoolean(
      rawConfig.REQUIRE_HUMAN_FINAL_SIGNOFF,
      "REQUIRE_HUMAN_FINAL_SIGNOFF"
    ),
    REQUIRE_HUMAN_CEREMONY: normalizeBoolean(
      rawConfig.REQUIRE_HUMAN_CEREMONY,
      "REQUIRE_HUMAN_CEREMONY"
    ),
    REQUIRE_JURISDICTION_POLICY_ENFORCEMENT: normalizeBoolean(
      rawConfig.REQUIRE_JURISDICTION_POLICY_ENFORCEMENT,
      "REQUIRE_JURISDICTION_POLICY_ENFORCEMENT"
    ),
    ENABLE_SHADOW_AUTONOMOUS_BENCHMARKING: normalizeBoolean(
      rawConfig.ENABLE_SHADOW_AUTONOMOUS_BENCHMARKING,
      "ENABLE_SHADOW_AUTONOMOUS_BENCHMARKING"
    ),
    STRICT_EVIDENCE_MODE: normalizeBoolean(rawConfig.STRICT_EVIDENCE_MODE, "STRICT_EVIDENCE_MODE"),
    PROTOCOL_PUBLICATION_MODE: validateEnum(
      rawConfig.PROTOCOL_PUBLICATION_MODE,
      "PROTOCOL_PUBLICATION_MODE",
      PUBLICATION_MODES
    ),
    EVIDENCE_OUTPUT_DIR: validateString(rawConfig.EVIDENCE_OUTPUT_DIR, "EVIDENCE_OUTPUT_DIR"),
  };

  if (config.LEGAL_MODE === "compliant") {
    if (config.AUTHORITY_PROVIDER !== "human_commissioned") {
      throw new ValidationError(
        "AUTHORITY_PROVIDER must be human_commissioned when LEGAL_MODE is compliant"
      );
    }

    if (config.ALLOW_AUTONOMOUS_EXECUTION) {
      throw new ValidationError(
        "ALLOW_AUTONOMOUS_EXECUTION must be false when LEGAL_MODE is compliant"
      );
    }

    if (!config.REQUIRE_HUMAN_FINAL_SIGNOFF || !config.REQUIRE_HUMAN_CEREMONY) {
      throw new ValidationError(
        "Compliant mode requires human ceremony and final signoff"
      );
    }
  }

  if (
    config.AUTHORITY_PROVIDER === "autonomous" &&
    (config.LEGAL_MODE !== "experimental" || !config.ALLOW_AUTONOMOUS_EXECUTION)
  ) {
    throw new ValidationError(
      "Autonomous authority provider is only allowed in explicit experimental mode"
    );
  }

  return config;
}

module.exports = {
  AUTHORITY_PROVIDERS,
  LEGAL_MODES,
  PUBLICATION_MODES,
  defaults,
  validateConfig,
};
