const AuthorityProvider = require("../../interfaces/AuthorityProvider");
const AuthorityExecutionRecord = require("../../models/AuthorityExecutionRecord");
const { ValidationError, createId, nowIso } = require("../../utils/validation");

class HumanCommissionedNotaryProvider extends AuthorityProvider {
  constructor(options = {}) {
    super();
    this.authorityId = options.authorityId || "human-notary-commission-001";
    this.eligibilityType = options.eligibilityType || "commissioned_notary";
  }

  validateAuthorityEligibility(context) {
    return {
      eligible: context.authorityLocation === context.jurisdiction,
      authorityId: this.authorityId,
      authorityEligibilityVerified: context.authorityLocation === context.jurisdiction,
      eligibilityType: this.eligibilityType,
    };
  }

  getAuthorityMode() {
    return "human_commissioned";
  }

  authorizeAct(context) {
    const eligibility = this.validateAuthorityEligibility(context);
    return new AuthorityExecutionRecord({
      executionId: createId("exec"),
      providerType: this.getAuthorityMode(),
      authorityId: eligibility.authorityId,
      authorityEligibilityVerified: eligibility.authorityEligibilityVerified,
      ceremonyPerformed: context.ceremonyStatus.state === "completed",
      certificateCompleted: false,
      finalRecordSigned: false,
      executionOutcome: "authorized",
      publicationAttempted: false,
      publicationMode: "disabled",
      publicationStatus: "not_attempted",
      publicationTxHashes: [],
      publicationErrors: [],
      publishedArtifacts: [],
      executedAt: nowIso(),
    });
  }

  refuseAct(context, reason) {
    const eligibility = this.validateAuthorityEligibility(context);
    return new AuthorityExecutionRecord({
      executionId: createId("exec"),
      providerType: this.getAuthorityMode(),
      authorityId: eligibility.authorityId,
      authorityEligibilityVerified: eligibility.authorityEligibilityVerified,
      ceremonyPerformed: context.ceremonyStatus.state === "completed",
      certificateCompleted: false,
      finalRecordSigned: false,
      executionOutcome: `refused:${reason}`,
      publicationAttempted: false,
      publicationMode: "disabled",
      publicationStatus: "not_attempted",
      publicationTxHashes: [],
      publicationErrors: [],
      publishedArtifacts: [],
      executedAt: nowIso(),
    });
  }

  administerCeremony(context, ceremonyRecord) {
    if (!ceremonyRecord || !ceremonyRecord.artifactRef) {
      throw new ValidationError("Human ceremony requires an explicit ceremony record artifact");
    }

    return {
      providerType: this.getAuthorityMode(),
      ceremonyStatus: "completed",
      ceremonyConfirmedAt: ceremonyRecord.completedAt || context.ceremonyStatus.confirmedAt || nowIso(),
      ceremonyId: ceremonyRecord.ceremonyId,
      artifactRef: ceremonyRecord.artifactRef,
    };
  }

  completeCertificate(context) {
    return {
      certificateId: `certificate-${context.actId}`,
      completedAt: nowIso(),
      authorityMode: this.getAuthorityMode(),
    };
  }

  signFinalRecord(context) {
    return {
      finalRecordId: `final-record-${context.actId}`,
      signedAt: nowIso(),
      signatureType: "human_notary_attestation",
    };
  }

  getAuditMetadata() {
    return {
      authorityId: this.authorityId,
      authorityMode: this.getAuthorityMode(),
      eligibilityType: this.eligibilityType,
    };
  }
}

module.exports = HumanCommissionedNotaryProvider;
