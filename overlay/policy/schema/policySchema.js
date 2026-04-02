const {
  ValidationError,
  validateArray,
  validateBoolean,
  validateEnum,
  validateObject,
  validatePlainObjectMap,
  validateString,
  validateStringArray,
} = require("../../utils/validation");
const { LEGAL_MODES, PUBLICATION_MODES } = require("../../config/schema");

const PROVIDER_TYPES = ["human_commissioned", "autonomous"];

function validatePolicyRule(rule, index) {
  const value = validateObject(rule, `policy.rules[${index}]`);
  validateString(value.id, `policy.rules[${index}].id`);
  validateString(value.jurisdiction, `policy.rules[${index}].jurisdiction`);
  validateString(value.actType, `policy.rules[${index}].actType`);
  validateString(value.documentType, `policy.rules[${index}].documentType`);
  validateStringArray(value.signerLocations, `policy.rules[${index}].signerLocations`, { minLength: 1 });
  validateStringArray(value.authorityLocations, `policy.rules[${index}].authorityLocations`, { minLength: 1 });
  validateArray(value.legalModes, `policy.rules[${index}].legalModes`, { minLength: 1 }).forEach((entry, ruleIndex) => {
    validateEnum(entry, `policy.rules[${index}].legalModes[${ruleIndex}]`, LEGAL_MODES);
  });
  validateArray(value.providerTypes, `policy.rules[${index}].providerTypes`, { minLength: 1 }).forEach(
    (entry, ruleIndex) => {
      validateEnum(entry, `policy.rules[${index}].providerTypes[${ruleIndex}]`, PROVIDER_TYPES);
    }
  );
  validateBoolean(value.requireHumanSupervision, `policy.rules[${index}].requireHumanSupervision`);
  validateBoolean(value.requireHumanCeremony, `policy.rules[${index}].requireHumanCeremony`);
  validateBoolean(value.requireHumanFinalSignoff, `policy.rules[${index}].requireHumanFinalSignoff`);
  validateStringArray(value.requiredFlowSteps, `policy.rules[${index}].requiredFlowSteps`, { minLength: 1 });
  validateStringArray(
    value.requiredEvidenceArtifacts,
    `policy.rules[${index}].requiredEvidenceArtifacts`,
    { minLength: 1 }
  );
  validateStringArray(
    value.requiredIdentityChecks,
    `policy.rules[${index}].requiredIdentityChecks`,
    { minLength: 1 }
  );
  validatePlainObjectMap(value.retentionPolicy, `policy.rules[${index}].retentionPolicy`);
  validatePlainObjectMap(value.recordingPolicy, `policy.rules[${index}].recordingPolicy`);
  validateStringArray(value.warnings, `policy.rules[${index}].warnings`);
  validateStringArray(value.blockedFraudSignals, `policy.rules[${index}].blockedFraudSignals`);
  validateArray(value.publicationModes, `policy.rules[${index}].publicationModes`, { minLength: 1 }).forEach(
    (entry, ruleIndex) => {
      validateEnum(
        entry,
        `policy.rules[${index}].publicationModes[${ruleIndex}]`,
        PUBLICATION_MODES
      );
    }
  );
  if (typeof value.maxRiskScore !== "number" || value.maxRiskScore < 0 || value.maxRiskScore > 100) {
    throw new ValidationError(`policy.rules[${index}].maxRiskScore must be a number from 0 to 100`);
  }
  return value;
}

function validatePolicySet(policySet) {
  const value = validateObject(policySet, "policySet");
  validateString(value.policyVersion, "policySet.policyVersion");
  validateArray(value.rules, "policySet.rules", { minLength: 1 }).forEach((rule, index) => {
    validatePolicyRule(rule, index);
  });
  return value;
}

module.exports = {
  validatePolicySet,
};
