/**
 * ============================================================================
 * File:      scripts/deploy-phase5.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Deploys all Phase 5 contracts:
 *   - Governance (DAO voting — requires NotaryToken from Phase 2)
 *   - JurisdictionManager (on-chain jurisdiction rule registry)
 *
 * Treasury is deployed in Phase 2 and reused here.
 * Run: npx hardhat run scripts/deploy-phase5.js --network <network>
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   AI Autonomous Notary Protocol — Phase 5 Deploy     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);

  const network = await ethers.provider.getNetwork();
  const deploymentsPath = path.join(__dirname, `../deployments/${network.name}.json`);
  const deployments = fs.existsSync(deploymentsPath)
    ? JSON.parse(fs.readFileSync(deploymentsPath)) : {};

  const notaryTokenAddr = deployments.NotaryToken?.address;
  if (!notaryTokenAddr) {
    throw new Error("NotaryToken address not found. Deploy Phase 2 first.");
  }

  async function deploy(name, factory, ...args) {
    console.log(`📦 Deploying ${name}...`);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const receipt = await contract.deploymentTransaction().wait();
    console.log(`   ✅ ${name}: ${address} (gas: ${receipt.gasUsed.toLocaleString()})`);
    deployments[name] = { address, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    return contract;
  }

  console.log("\n── Phase 5A: Governance ──\n");
  const Governance = await ethers.getContractFactory("Governance");
  const governance = await deploy(
    "Governance",
    Governance,
    deployer.address,               // admin (multi-sig in production)
    notaryTokenAddr,                // $NOTARY voting token
    2n * 24n * 60n * 60n,           // votingDelay: 2 days
    7n * 24n * 60n * 60n,           // votingPeriod: 7 days
    ethers.parseEther("100000"),    // proposalThreshold: 100,000 NOTARY
    400n                            // quorumBP: 4% of supply
  );

  console.log("\n── Phase 5B: Jurisdiction Manager ──\n");
  const JurisdictionManager = await ethers.getContractFactory("JurisdictionManager");
  const govAddr = await governance.getAddress();
  await deploy(
    "JurisdictionManager",
    JurisdictionManager,
    deployer.address,  // admin
    govAddr            // governance (RULE_APPROVER)
  );

  // Grant PROPOSAL_THRESHOLD delegate power — in production, $NOTARY holders
  // self-delegate. For testnet, deployer delegates to self.
  const notaryToken = await ethers.getContractAt("NotaryToken", notaryTokenAddr);
  await (await notaryToken.delegate(deployer.address)).wait();
  console.log("\n   ✅ Delegated voting power to deployer");

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployments, null, 2));
  console.log(`\n💾 Saved to deployments/${network.name}.json`);
  console.log("\n✅ Phase 5 deployment complete!\n");
  console.log("⚠️  Next steps:");
  console.log("   1. Transfer EXECUTOR_ROLE to the admin multi-sig wallet");
  console.log("   2. Transfer DEFAULT_ADMIN_ROLE to the multi-sig wallet");
  console.log("   3. Set proposalThreshold appropriate to circulating supply");
  console.log("   4. Enable full DAO execution after Phase 2 productization\n");
}

main().catch(err => { console.error(err); process.exit(1); });
