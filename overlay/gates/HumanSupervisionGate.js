const HumanSupervisionGateInterface = require("../interfaces/HumanSupervisionGate");
const { ValidationError } = require("../utils/validation");

class HumanSupervisionGate extends HumanSupervisionGateInterface {
  constructor(config) {
    super();
    this.config = config;
  }

  assertCompliantProvider(context) {
    if (context.legalMode === "compliant" && context.activeAuthorityProvider !== "human_commissioned") {
      throw new ValidationError("Compliant mode requires the human_commissioned authority provider");
    }
    return true;
  }

  assertCeremonyAllowed(context, policyDecision) {
    this.assertCompliantProvider(context);
    if (!policyDecision || !policyDecision.allowed) {
      throw new ValidationError("Ceremony blocked: missing or disallowed policy decision");
    }

    if (policyDecision.requireHumanCeremony && this.config.REQUIRE_HUMAN_CEREMONY !== true) {
      throw new ValidationError("Ceremony blocked: configuration does not satisfy required human ceremony");
    }

    return true;
  }

  assertFinalizationAllowed(context, policyDecision, reviewDecision, authorityExecution, evidenceArtifacts = []) {
    this.assertCompliantProvider(context);

    if (!policyDecision) {
      throw new ValidationError("Finalization blocked: missing policy decision");
    }
    if (!policyDecision.allowed) {
      throw new ValidationError(`Finalization blocked: ${policyDecision.blockReason || "policy disallowed flow"}`);
    }
    if (!reviewDecision) {
      throw new ValidationError("Finalization blocked: missing human review decision");
    }
    if (policyDecision.requireHumanSupervision && reviewDecision.decision !== "approve") {
      throw new ValidationError("Finalization blocked: required human approval was not granted");
    }
    if (policyDecision.requireHumanFinalSignoff && reviewDecision.finalApproval !== true) {
      throw new ValidationError("Finalization blocked: missing final human signoff");
    }
    if (reviewDecision.finalRefusal === true) {
      throw new ValidationError("Finalization blocked: human reviewer issued final refusal");
    }
    if (policyDecision.requireHumanCeremony && reviewDecision.ceremonyConfirmed !== true) {
      throw new ValidationError("Finalization blocked: human ceremony confirmation is missing");
    }
    if (policyDecision.requireHumanCeremony && context.ceremonyStatus.state !== "completed") {
      throw new ValidationError("Finalization blocked: ceremony has not been completed");
    }
    if (!authorityExecution) {
      throw new ValidationError("Finalization blocked: missing authority execution record");
    }
    if (!authorityExecution.authorityEligibilityVerified) {
      throw new ValidationError("Finalization blocked: authority eligibility not verified");
    }
    if (authorityExecution.providerType !== policyDecision.requiredAuthorityMode) {
      throw new ValidationError("Finalization blocked: wrong authority provider executed the act");
    }
    if (context.identityProofingStatus.state !== "verified") {
      throw new ValidationError("Finalization blocked: identity proofing is incomplete");
    }

    const completedChecks = context.identityProofingStatus.completedChecks || [];
    const missingChecks = policyDecision.requiredIdentityChecks.filter(
      (check) => !completedChecks.includes(check)
    );
    if (missingChecks.length > 0) {
      throw new ValidationError(`Finalization blocked: missing identity checks ${missingChecks.join(", ")}`);
    }

    if (context.aiAnalysisStatus.state !== "completed" || !context.aiAnalysisStatus.analysisId) {
      throw new ValidationError("Finalization blocked: AI findings have not been completed");
    }
    if (context.aiAnalysisStatus.reviewed !== true) {
      throw new ValidationError("Finalization blocked: AI findings have not been reviewed by a human");
    }

    if (this.config.STRICT_EVIDENCE_MODE) {
      const missingArtifacts = policyDecision.requiredEvidenceArtifacts.filter(
        (artifact) => !evidenceArtifacts.includes(artifact)
      );
      if (missingArtifacts.length > 0) {
        throw new ValidationError(
          `Finalization blocked: missing required evidence artifacts ${missingArtifacts.join(", ")}`
        );
      }
    }

    return true;
  }
}

module.exports = HumanSupervisionGate;
