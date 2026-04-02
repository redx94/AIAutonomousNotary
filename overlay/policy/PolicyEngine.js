const PolicyEngineInterface = require("../interfaces/PolicyEngine");
const PolicyDecision = require("../models/PolicyDecision");
const defaultPolicySet = require("./data/defaultRules.json");
const { validatePolicySet } = require("./schema/policySchema");
const { createId, nowIso } = require("../utils/validation");

class PolicyEngine extends PolicyEngineInterface {
  constructor(options = {}) {
    super();
    this.config = options.config;
    this.policySet = validatePolicySet(options.policySet || defaultPolicySet);
  }

  validatePolicySet() {
    return this.policySet;
  }

  getPolicy(jurisdiction, actType, documentType) {
    return (
      this.policySet.rules.find((rule) => {
        const jurisdictionMatch = rule.jurisdiction === jurisdiction;
        const actTypeMatch = rule.actType === actType;
        const documentTypeMatch = rule.documentType === documentType || rule.documentType === "*";
        return jurisdictionMatch && actTypeMatch && documentTypeMatch;
      }) || null
    );
  }

  evaluate(context) {
    if (context.legalMode === "compliant" && !this.config.REQUIRE_JURISDICTION_POLICY_ENFORCEMENT) {
      return this.#buildDecision({
        allowed: false,
        blockReason: "Jurisdiction policy enforcement is disabled by runtime configuration",
        requiredAuthorityMode: "human_commissioned",
        requiredFlowSteps: [],
        requiredEvidenceArtifacts: [],
        requiredIdentityChecks: [],
        retentionPolicy: {},
        recordingPolicy: {},
        warnings: ["Jurisdiction policy enforcement must remain enabled in compliant mode"],
      });
    }

    const policy = this.getPolicy(context.jurisdiction, context.actType, context.documentType);

    if (!policy) {
      return this.#buildDecision({
        allowed: false,
        blockReason: `No policy found for ${context.jurisdiction}/${context.actType}/${context.documentType}`,
        requiredAuthorityMode: "human_commissioned",
        requiredFlowSteps: [],
        requiredEvidenceArtifacts: [],
        requiredIdentityChecks: [],
        retentionPolicy: {},
        recordingPolicy: {},
        warnings: ["Missing jurisdiction policy"],
      });
    }

    const providerType = context.activeAuthorityProvider;
    const signerLocation = context.signerLocation;
    const authorityLocation = context.authorityLocation;
    const completedIdentityChecks = context.identityProofingStatus.completedChecks || [];
    const missingIdentityChecks = policy.requiredIdentityChecks.filter(
      (check) => !completedIdentityChecks.includes(check)
    );
    const riskScore = context.aiAnalysisStatus.riskScore || 0;
    const fraudSignals = context.aiAnalysisStatus.fraudSignals || [];
    const blockedSignal = fraudSignals.find((signal) => policy.blockedFraudSignals.includes(signal));

    let blockReason = null;
    if (!policy.legalModes.includes(context.legalMode)) {
      blockReason = `Policy ${policy.id} does not allow legal mode ${context.legalMode}`;
    } else if (!policy.providerTypes.includes(providerType)) {
      blockReason = `Policy ${policy.id} requires provider ${policy.providerTypes[0]} but found ${providerType}`;
    } else if (!this.#matchesLocation(policy.signerLocations, signerLocation)) {
      blockReason = `Signer location ${signerLocation} is outside policy scope`;
    } else if (!this.#matchesLocation(policy.authorityLocations, authorityLocation)) {
      blockReason = `Authority location ${authorityLocation} is outside policy scope`;
    } else if (context.identityProofingStatus.state !== "verified") {
      blockReason = "Identity proofing is not verified";
    } else if (missingIdentityChecks.length > 0) {
      blockReason = `Missing identity checks: ${missingIdentityChecks.join(", ")}`;
    } else if (blockedSignal) {
      blockReason = `Blocked fraud signal detected: ${blockedSignal}`;
    } else if (riskScore > policy.maxRiskScore) {
      blockReason = `Risk score ${riskScore} exceeds policy threshold ${policy.maxRiskScore}`;
    } else if (!policy.publicationModes.includes(this.config.PROTOCOL_PUBLICATION_MODE)) {
      blockReason = `Publication mode ${this.config.PROTOCOL_PUBLICATION_MODE} is not allowed by policy`;
    }

    return this.#buildDecision({
      allowed: !blockReason,
      blockReason,
      requiredAuthorityMode: policy.providerTypes[0],
      requireHumanSupervision: policy.requireHumanSupervision,
      requireHumanCeremony: policy.requireHumanCeremony,
      requireHumanFinalSignoff: policy.requireHumanFinalSignoff,
      requiredFlowSteps: policy.requiredFlowSteps,
      requiredEvidenceArtifacts: policy.requiredEvidenceArtifacts,
      requiredIdentityChecks: policy.requiredIdentityChecks,
      retentionPolicy: policy.retentionPolicy,
      recordingPolicy: policy.recordingPolicy,
      warnings: policy.warnings,
      policyVersion: this.policySet.policyVersion,
    });
  }

  #buildDecision(values) {
    return new PolicyDecision({
      decisionId: createId("policy"),
      allowed: values.allowed,
      blockReason: values.blockReason || null,
      requiredAuthorityMode: values.requiredAuthorityMode,
      requireHumanSupervision: values.requireHumanSupervision !== false,
      requireHumanCeremony: values.requireHumanCeremony !== false,
      requireHumanFinalSignoff: values.requireHumanFinalSignoff !== false,
      requiredFlowSteps: values.requiredFlowSteps,
      requiredEvidenceArtifacts: values.requiredEvidenceArtifacts,
      requiredIdentityChecks: values.requiredIdentityChecks,
      retentionPolicy: values.retentionPolicy,
      recordingPolicy: values.recordingPolicy,
      warnings: values.warnings || [],
      policyVersion: values.policyVersion || this.policySet.policyVersion,
      evaluatedAt: nowIso(),
    });
  }

  #matchesLocation(allowedLocations, location) {
    return allowedLocations.includes("*") || allowedLocations.includes(location);
  }
}

module.exports = PolicyEngine;
