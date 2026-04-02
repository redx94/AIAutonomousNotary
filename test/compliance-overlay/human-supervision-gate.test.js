const { expect } = require("chai");

const HumanSupervisionGate = require("../../overlay/gates/HumanSupervisionGate");
const {
  buildAllowedPolicyDecision,
  buildAuthorityExecutionRecord,
  buildConfig,
  buildHumanReviewDecision,
  buildValidContext,
} = require("./helpers");

describe("Compliance Overlay - human supervision gate", function () {
  const evidenceArtifacts = [
    "manifest.json",
    "policy-decision.json",
    "ai-analysis.json",
    "human-review.json",
    "ceremony-record.json",
    "authority-execution.json",
  ];

  it("blocks when review is missing", function () {
    const config = buildConfig();
    const gate = new HumanSupervisionGate(config);

    expect(() =>
      gate.assertFinalizationAllowed(
        buildValidContext(config),
        buildAllowedPolicyDecision(),
        null,
        buildAuthorityExecutionRecord(),
        evidenceArtifacts
      )
    ).to.throw("missing human review decision");
  });

  it("blocks when ceremony is missing", function () {
    const config = buildConfig();
    const gate = new HumanSupervisionGate(config);
    const context = buildValidContext(config, {
      ceremonyStatus: { state: "pending", confirmedAt: null },
    });

    expect(() =>
      gate.assertFinalizationAllowed(
        context,
        buildAllowedPolicyDecision(),
        buildHumanReviewDecision({ ceremonyConfirmed: false }),
        buildAuthorityExecutionRecord(),
        evidenceArtifacts
      )
    ).to.throw("ceremony confirmation");
  });

  it("blocks when final signoff is missing", function () {
    const config = buildConfig();
    const gate = new HumanSupervisionGate(config);

    expect(() =>
      gate.assertFinalizationAllowed(
        buildValidContext(config),
        buildAllowedPolicyDecision(),
        buildHumanReviewDecision({ finalApproval: false }),
        buildAuthorityExecutionRecord(),
        evidenceArtifacts
      )
    ).to.throw("missing final human signoff");
  });

  it("blocks when provider is wrong", function () {
    const config = buildConfig();
    const gate = new HumanSupervisionGate(config);
    const context = buildValidContext(config, {
      activeAuthorityProvider: "autonomous",
    });

    expect(() =>
      gate.assertFinalizationAllowed(
        context,
        buildAllowedPolicyDecision(),
        buildHumanReviewDecision(),
        buildAuthorityExecutionRecord({ providerType: "autonomous" }),
        evidenceArtifacts
      )
    ).to.throw("human_commissioned authority provider");
  });

  it("blocks when evidence artifacts are missing", function () {
    const config = buildConfig();
    const gate = new HumanSupervisionGate(config);

    expect(() =>
      gate.assertFinalizationAllowed(
        buildValidContext(config),
        buildAllowedPolicyDecision(),
        buildHumanReviewDecision(),
        buildAuthorityExecutionRecord(),
        ["manifest.json"]
      )
    ).to.throw("missing required evidence artifacts");
  });

  it("does not enforce evidence artifacts when strict evidence mode is disabled", function () {
    const config = buildConfig({
      STRICT_EVIDENCE_MODE: false,
    });
    const gate = new HumanSupervisionGate(config);

    expect(() =>
      gate.assertFinalizationAllowed(
        buildValidContext(config),
        buildAllowedPolicyDecision(),
        buildHumanReviewDecision(),
        buildAuthorityExecutionRecord(),
        ["manifest.json"]
      )
    ).not.to.throw();
  });
});
