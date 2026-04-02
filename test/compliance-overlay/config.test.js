const { expect } = require("chai");

const loadConfig = require("../../overlay/config/loadConfig");
const { buildConfig } = require("./helpers");

describe("Compliance Overlay - config", function () {
  it("uses safe compliant defaults", function () {
    const config = buildConfig();
    expect(config.LEGAL_MODE).to.equal("compliant");
    expect(config.AUTHORITY_PROVIDER).to.equal("human_commissioned");
    expect(config.ALLOW_AUTONOMOUS_EXECUTION).to.equal(false);
    expect(config.PROTOCOL_PUBLICATION_MODE).to.equal("disabled");
  });

  it("fails closed on invalid compliant config", function () {
    expect(() =>
      loadConfig({
        LEGAL_MODE: "compliant",
        AUTHORITY_PROVIDER: "autonomous",
        ALLOW_AUTONOMOUS_EXECUTION: true,
      })
    ).to.throw("AUTHORITY_PROVIDER must be human_commissioned when LEGAL_MODE is compliant");
  });

  it("keeps experimental autonomous config explicitly isolated", function () {
    const config = buildConfig({
      LEGAL_MODE: "experimental",
      AUTHORITY_PROVIDER: "autonomous",
      ALLOW_AUTONOMOUS_EXECUTION: true,
      REQUIRE_HUMAN_FINAL_SIGNOFF: false,
      REQUIRE_HUMAN_CEREMONY: false,
      PROTOCOL_PUBLICATION_MODE: "best_effort",
    });

    expect(config.LEGAL_MODE).to.equal("experimental");
    expect(config.AUTHORITY_PROVIDER).to.equal("autonomous");
    expect(config.ALLOW_AUTONOMOUS_EXECUTION).to.equal(true);
  });

  it("uses jurisdiction policy enforcement as a runtime control", function () {
    const config = buildConfig({
      REQUIRE_JURISDICTION_POLICY_ENFORCEMENT: false,
    });

    expect(config.REQUIRE_JURISDICTION_POLICY_ENFORCEMENT).to.equal(false);
  });
});
