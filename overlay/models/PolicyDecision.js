const {
  validateBoolean,
  validateObject,
  validatePlainObjectMap,
  validateString,
  validateStringArray,
  validateTimestamp,
} = require("../utils/validation");

class PolicyDecision {
  constructor(payload) {
    const value = validateObject(payload, "PolicyDecision");
    validateString(value.decisionId, "PolicyDecision.decisionId");
    validateBoolean(value.allowed, "PolicyDecision.allowed");
    if (value.blockReason !== null) {
      validateString(value.blockReason, "PolicyDecision.blockReason", { allowNull: true });
    }
    validateString(value.requiredAuthorityMode, "PolicyDecision.requiredAuthorityMode");
    validateBoolean(value.requireHumanSupervision, "PolicyDecision.requireHumanSupervision");
    validateBoolean(value.requireHumanCeremony, "PolicyDecision.requireHumanCeremony");
    validateBoolean(value.requireHumanFinalSignoff, "PolicyDecision.requireHumanFinalSignoff");
    validateStringArray(value.requiredFlowSteps, "PolicyDecision.requiredFlowSteps");
    validateStringArray(value.requiredEvidenceArtifacts, "PolicyDecision.requiredEvidenceArtifacts");
    validateStringArray(value.requiredIdentityChecks, "PolicyDecision.requiredIdentityChecks");
    validatePlainObjectMap(value.retentionPolicy, "PolicyDecision.retentionPolicy");
    validatePlainObjectMap(value.recordingPolicy, "PolicyDecision.recordingPolicy");
    validateStringArray(value.warnings, "PolicyDecision.warnings");
    validateString(value.policyVersion, "PolicyDecision.policyVersion");
    validateTimestamp(value.evaluatedAt, "PolicyDecision.evaluatedAt");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = PolicyDecision;
