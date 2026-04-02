const {
  validateObject,
  validateSigner,
  validateStatusObject,
  validateString,
  validateTimestamps,
} = require("../utils/validation");

class ActContext {
  constructor(payload) {
    const value = validateObject(payload, "ActContext");
    validateString(value.actId, "ActContext.actId");
    validateString(value.documentId, "ActContext.documentId");
    validateString(value.documentHash, "ActContext.documentHash");
    validateString(value.actType, "ActContext.actType");
    validateString(value.documentType, "ActContext.documentType");
    validateString(value.jurisdiction, "ActContext.jurisdiction");
    validateSigner(value.signer, "ActContext.signer");
    validateString(value.signerLocation, "ActContext.signerLocation");
    validateString(value.authorityLocation, "ActContext.authorityLocation");
    validateString(value.requestedAuthorityMode, "ActContext.requestedAuthorityMode");
    validateString(value.activeAuthorityProvider, "ActContext.activeAuthorityProvider");
    validateString(value.legalMode, "ActContext.legalMode");
    validateStatusObject(value.identityProofingStatus, "ActContext.identityProofingStatus");
    validateStatusObject(value.aiAnalysisStatus, "ActContext.aiAnalysisStatus");
    validateStatusObject(value.humanReviewStatus, "ActContext.humanReviewStatus");
    validateStatusObject(value.ceremonyStatus, "ActContext.ceremonyStatus");
    if (value.policyDecisionId !== null) {
      validateString(value.policyDecisionId, "ActContext.policyDecisionId", { allowNull: true });
    }
    if (value.evidenceBundleId !== null) {
      validateString(value.evidenceBundleId, "ActContext.evidenceBundleId", { allowNull: true });
    }
    validateTimestamps(value.timestamps, "ActContext.timestamps");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = ActContext;
