const fs = require("fs");
const os = require("os");
const path = require("path");

const loadConfig = require("../../overlay/config/loadConfig");
const ActContext = require("../../overlay/models/ActContext");
const PolicyDecision = require("../../overlay/models/PolicyDecision");
const HumanReviewDecision = require("../../overlay/models/HumanReviewDecision");
const AuthorityExecutionRecord = require("../../overlay/models/AuthorityExecutionRecord");
const EventRecorder = require("../../overlay/evidence/EventRecorder");
const EventTypes = require("../../overlay/evidence/EventTypes");
const ProtocolPublicationService = require("../../overlay/services/ProtocolPublicationService");
const ContractPublicationAdapter = require("../../overlay/services/ContractPublicationAdapter");
const { createId, nowIso } = require("../../overlay/utils/validation");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ai-notary-overlay-"));
}

function buildConfig(overrides = {}) {
  return loadConfig({
    EVIDENCE_OUTPUT_DIR: makeTempDir(),
    ...overrides,
  });
}

function buildValidInput(overrides = {}) {
  return {
    jurisdiction: "US",
    signerLocation: "US",
    authorityLocation: "US",
    signer: {
      displayName: "Test Signer",
      email: "test.signer@example.com",
      ...(overrides.signer || {}),
    },
    document: {
      documentType: "contract",
      documentContent: "Test compliant content.",
      ...(overrides.document || {}),
    },
    aiAnalysis: {
      riskScore: 20,
      fraudSignals: [],
      ...(overrides.aiAnalysis || {}),
    },
    identityProofing: {
      state: "verified",
      completedChecks: ["identity_verified", "credential_screened"],
      ...(overrides.identityProofing || {}),
    },
    review: {
      reviewerId: "reviewer-001",
      reviewerType: "commissioned_notary",
      decision: "approve",
      ceremonyConfirmed: true,
      finalApproval: true,
      finalRefusal: false,
      ...(overrides.review || {}),
    },
    ceremony: {
      performedBy: "reviewer-001",
      artifactRef: "ceremony://test-artifact",
      notes: "Test human ceremony artifact.",
      ...(overrides.ceremony || {}),
    },
    ...overrides,
  };
}

function buildValidContext(config, overrides = {}) {
  return new ActContext({
    actId: createId("act"),
    documentId: createId("document"),
    documentHash: "abc123hash",
    actType: "notarization",
    documentType: "contract",
    jurisdiction: "US",
    signer: {
      signerId: createId("signer"),
      displayName: "Context Signer",
      email: "context.signer@example.com",
    },
    signerLocation: "US",
    authorityLocation: "US",
    requestedAuthorityMode: config.AUTHORITY_PROVIDER,
    activeAuthorityProvider: config.AUTHORITY_PROVIDER,
    legalMode: config.LEGAL_MODE,
    identityProofingStatus: {
      state: "verified",
      completedChecks: ["identity_verified", "credential_screened"],
      verifiedAt: nowIso(),
    },
    aiAnalysisStatus: {
      state: "completed",
      analysisId: createId("analysis"),
      reviewed: true,
      riskScore: 25,
      fraudSignals: [],
    },
    humanReviewStatus: {
      state: "completed",
      reviewId: createId("review"),
      finalApproval: true,
    },
    ceremonyStatus: {
      state: "completed",
      confirmedAt: nowIso(),
    },
    policyDecisionId: createId("policy"),
    evidenceBundleId: createId("bundle"),
    timestamps: {
      createdAt: nowIso(),
    },
    ...overrides,
  });
}

function buildAllowedPolicyDecision(overrides = {}) {
  return new PolicyDecision({
    decisionId: createId("policy"),
    allowed: true,
    blockReason: null,
    requiredAuthorityMode: "human_commissioned",
    requireHumanSupervision: true,
    requireHumanCeremony: true,
    requireHumanFinalSignoff: true,
    requiredFlowSteps: ["human_review", "ceremony", "finalization"],
    requiredEvidenceArtifacts: [
      "manifest.json",
      "policy-decision.json",
      "ai-analysis.json",
      "human-review.json",
      "ceremony-record.json",
      "authority-execution.json",
    ],
    requiredIdentityChecks: ["identity_verified", "credential_screened"],
    retentionPolicy: { years: 7 },
    recordingPolicy: { ceremonyRecording: "required" },
    warnings: [],
    policyVersion: "test-policy",
    evaluatedAt: nowIso(),
    ...overrides,
  });
}

function buildHumanReviewDecision(overrides = {}) {
  return new HumanReviewDecision({
    reviewId: createId("review"),
    reviewerId: "reviewer-001",
    reviewerType: "commissioned_notary",
    reviewedAIAnalysisId: createId("analysis"),
    decision: "approve",
    overrides: {},
    notes: "Approved.",
    ceremonyConfirmed: true,
    finalApproval: true,
    finalRefusal: false,
    completedAt: nowIso(),
    ...overrides,
  });
}

function buildAuthorityExecutionRecord(overrides = {}) {
  return new AuthorityExecutionRecord({
    executionId: createId("exec"),
    providerType: "human_commissioned",
    authorityId: "authority-001",
    authorityEligibilityVerified: true,
    ceremonyPerformed: true,
    certificateCompleted: true,
    finalRecordSigned: true,
    executionOutcome: "authorized",
    publicationAttempted: false,
    publicationMode: "disabled",
    publicationStatus: "disabled",
    publicationTxHashes: [],
    publicationErrors: [],
    publishedArtifacts: [],
    executedAt: nowIso(),
    ...overrides,
  });
}

function buildPublicationService(config, eventRecorder, publishImplementation) {
  return new ProtocolPublicationService({
    config,
    eventRecorder,
    eventTypes: EventTypes,
    adapter: new ContractPublicationAdapter({
      publishImplementation,
    }),
  });
}

module.exports = {
  EventRecorder,
  EventTypes,
  buildAllowedPolicyDecision,
  buildAuthorityExecutionRecord,
  buildConfig,
  buildHumanReviewDecision,
  buildPublicationService,
  buildValidContext,
  buildValidInput,
  makeTempDir,
};
