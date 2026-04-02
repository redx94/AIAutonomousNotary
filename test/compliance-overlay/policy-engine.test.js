const { expect } = require("chai");

const PolicyEngine = require("../../overlay/policy/PolicyEngine");
const { buildConfig, buildValidContext } = require("./helpers");

describe("Compliance Overlay - policy engine", function () {
  it("allows flow when rules are satisfied", function () {
    const config = buildConfig();
    const engine = new PolicyEngine({ config });
    const decision = engine.evaluate(buildValidContext(config));

    expect(decision.allowed).to.equal(true);
    expect(decision.requiredAuthorityMode).to.equal("human_commissioned");
  });

  it("blocks flow when rules are missing", function () {
    const config = buildConfig();
    const engine = new PolicyEngine({ config });
    const context = buildValidContext(config, { jurisdiction: "CA" });
    const decision = engine.evaluate(context);

    expect(decision.allowed).to.equal(false);
    expect(decision.blockReason).to.include("No policy found");
  });

  it("requires human supervision when configured", function () {
    const config = buildConfig();
    const engine = new PolicyEngine({ config });
    const decision = engine.evaluate(buildValidContext(config));

    expect(decision.requireHumanSupervision).to.equal(true);
    expect(decision.requireHumanCeremony).to.equal(true);
    expect(decision.requireHumanFinalSignoff).to.equal(true);
  });

  it("requires evidence artifacts when configured", function () {
    const config = buildConfig();
    const engine = new PolicyEngine({ config });
    const decision = engine.evaluate(buildValidContext(config));

    expect(decision.requiredEvidenceArtifacts).to.include("manifest.json");
    expect(decision.requiredEvidenceArtifacts).to.include("protocol-publication.json");
  });

  it("blocks compliant execution when jurisdiction policy enforcement is disabled", function () {
    const config = buildConfig({
      REQUIRE_JURISDICTION_POLICY_ENFORCEMENT: false,
    });
    const engine = new PolicyEngine({ config });
    const decision = engine.evaluate(buildValidContext(config));

    expect(decision.allowed).to.equal(false);
    expect(decision.blockReason).to.include("Jurisdiction policy enforcement is disabled");
  });
});
