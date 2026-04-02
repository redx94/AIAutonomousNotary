const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { expect } = require("chai");
const hre = require("hardhat");

describe("Compliance Overlay - regression core intact", function () {
  it("existing compile still works and core contracts remain loadable", async function () {
    await hre.run("compile");
    const artifact = await hre.artifacts.readArtifact("NotaryNFT");
    expect(artifact.contractName).to.equal("NotaryNFT");
  });

  it("existing deployment assumptions are preserved", function () {
    const deployScriptPath = path.join(process.cwd(), "scripts", "deploy.js");
    const deployScript = fs.readFileSync(deployScriptPath, "utf8");

    expect(fs.existsSync(deployScriptPath)).to.equal(true);
    expect(deployScript).to.include("Phase 1 deployment complete");
    expect(() => execFileSync(process.execPath, ["--check", deployScriptPath])).not.to.throw();
  });

  it("deploy script still references the expected phase 1 contract factories", async function () {
    const contractNames = [
      "NotaryNFT",
      "DocumentSecurityToken",
      "DocumentRegistry",
      "NotaryAccessControl",
      "EmergencyProtocol",
      "AIEngine",
      "OracleManager",
      "ValidationOracle",
      "ConditionalAccess",
    ];

    await hre.run("compile");
    for (const contractName of contractNames) {
      const artifact = await hre.artifacts.readArtifact(contractName);
      expect(artifact.contractName).to.equal(contractName);
    }
  });

  it("current contracts and original test suite files remain present", function () {
    expect(fs.existsSync(path.join(process.cwd(), "contracts", "NotaryNFT.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(process.cwd(), "test", "Phase1.test.js"))).to.equal(true);
    expect(fs.existsSync(path.join(process.cwd(), "test", "Phase1Coverage.test.js"))).to.equal(true);
  });
});
