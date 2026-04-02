const AuthorityProvider = require("../../interfaces/AuthorityProvider");
const AuthorityExecutionRecord = require("../../models/AuthorityExecutionRecord");
const { ValidationError, createId, nowIso } = require("../../utils/validation");

class AutonomousAuthorityProvider extends AuthorityProvider {
  constructor(options = {}) {
    super();
    this.authorityId = options.authorityId || "autonomous-agent-001";
  }

  validateAuthorityEligibility(context) {
    const eligible = context.legalMode === "experimental";
    return {
      eligible,
      authorityId: this.authorityId,
      authorityEligibilityVerified: eligible,
      eligibilityType: "experimental_autonomous_authority",
    };
  }

  getAuthorityMode() {
    return "autonomous";
  }

  authorizeAct(context) {
    if (context.legalMode === "compliant") {
      throw new ValidationError("Autonomous authority cannot finalize legally operative acts in compliant mode");
    }

    return new AuthorityExecutionRecord({
      executionId: createId("exec"),
      providerType: this.getAuthorityMode(),
      authorityId: this.authorityId,
      authorityEligibilityVerified: true,
      ceremonyPerformed: false,
      certificateCompleted: false,
      finalRecordSigned: false,
      executionOutcome: "experimental_authorized",
      publicationAttempted: false,
      publicationMode: "disabled",
      publicationStatus: "not_attempted",
      publicationTxHashes: [],
      publicationErrors: [],
      publishedArtifacts: [],
      executedAt: nowIso(),
    });
  }

  refuseAct(_context, reason) {
    return new AuthorityExecutionRecord({
      executionId: createId("exec"),
      providerType: this.getAuthorityMode(),
      authorityId: this.authorityId,
      authorityEligibilityVerified: true,
      ceremonyPerformed: false,
      certificateCompleted: false,
      finalRecordSigned: false,
      executionOutcome: `experimental_refused:${reason}`,
      publicationAttempted: false,
      publicationMode: "disabled",
      publicationStatus: "not_attempted",
      publicationTxHashes: [],
      publicationErrors: [],
      publishedArtifacts: [],
      executedAt: nowIso(),
    });
  }

  administerCeremony() {
    return {
      providerType: this.getAuthorityMode(),
      ceremonyStatus: "skipped",
      ceremonyConfirmedAt: null,
    };
  }

  completeCertificate(context) {
    return {
      certificateId: `experimental-certificate-${context.actId}`,
      completedAt: nowIso(),
      authorityMode: this.getAuthorityMode(),
    };
  }

  signFinalRecord(context) {
    return {
      finalRecordId: `experimental-final-record-${context.actId}`,
      signedAt: nowIso(),
      signatureType: "autonomous_signature_preview",
    };
  }

  getAuditMetadata() {
    return {
      authorityId: this.authorityId,
      authorityMode: this.getAuthorityMode(),
      eligibilityType: "experimental_autonomous_authority",
    };
  }
}

module.exports = AutonomousAuthorityProvider;
