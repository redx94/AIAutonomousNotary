const {
  validateArray,
  validateBoolean,
  validateObject,
  validateString,
  validateTimestamp,
} = require("../utils/validation");

class AuthorityExecutionRecord {
  constructor(payload) {
    const value = validateObject(payload, "AuthorityExecutionRecord");
    validateString(value.executionId, "AuthorityExecutionRecord.executionId");
    validateString(value.providerType, "AuthorityExecutionRecord.providerType");
    validateString(value.authorityId, "AuthorityExecutionRecord.authorityId");
    validateBoolean(
      value.authorityEligibilityVerified,
      "AuthorityExecutionRecord.authorityEligibilityVerified"
    );
    validateBoolean(value.ceremonyPerformed, "AuthorityExecutionRecord.ceremonyPerformed");
    validateBoolean(value.certificateCompleted, "AuthorityExecutionRecord.certificateCompleted");
    validateBoolean(value.finalRecordSigned, "AuthorityExecutionRecord.finalRecordSigned");
    validateString(value.executionOutcome, "AuthorityExecutionRecord.executionOutcome");
    validateBoolean(value.publicationAttempted, "AuthorityExecutionRecord.publicationAttempted");
    validateString(value.publicationMode, "AuthorityExecutionRecord.publicationMode");
    validateString(value.publicationStatus, "AuthorityExecutionRecord.publicationStatus");
    validateArray(value.publicationTxHashes, "AuthorityExecutionRecord.publicationTxHashes");
    validateArray(value.publicationErrors, "AuthorityExecutionRecord.publicationErrors");
    validateArray(value.publishedArtifacts, "AuthorityExecutionRecord.publishedArtifacts");
    validateTimestamp(value.executedAt, "AuthorityExecutionRecord.executedAt");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = AuthorityExecutionRecord;
