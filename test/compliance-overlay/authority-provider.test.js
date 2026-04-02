const { expect } = require("chai");

const AuthorityProvider = require("../../overlay/interfaces/AuthorityProvider");
const HumanCommissionedNotaryProvider = require("../../overlay/authority/human/HumanCommissionedNotaryProvider");
const AutonomousAuthorityProvider = require("../../overlay/authority/autonomous/AutonomousAuthorityProvider");
const { buildConfig, buildValidContext } = require("./helpers");

describe("Compliance Overlay - authority providers", function () {
  it("both providers conform to the interface", function () {
    const human = new HumanCommissionedNotaryProvider();
    const autonomous = new AutonomousAuthorityProvider();

    expect(human).to.be.instanceOf(AuthorityProvider);
    expect(autonomous).to.be.instanceOf(AuthorityProvider);
    expect(human.getAuthorityMode()).to.equal("human_commissioned");
    expect(autonomous.getAuthorityMode()).to.equal("autonomous");
  });

  it("human provider is usable in compliant mode", function () {
    const config = buildConfig();
    const provider = new HumanCommissionedNotaryProvider();
    const context = buildValidContext(config);
    const record = provider.authorizeAct(context);

    expect(record.providerType).to.equal("human_commissioned");
    expect(record.authorityEligibilityVerified).to.equal(true);
  });

  it("autonomous provider is blocked from compliant finalization", function () {
    const config = buildConfig();
    const provider = new AutonomousAuthorityProvider();
    const context = buildValidContext(config, {
      activeAuthorityProvider: "autonomous",
    });

    expect(() => provider.authorizeAct(context)).to.throw("Autonomous authority cannot finalize");
  });
});
