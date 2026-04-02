/**
 * ============================================================================
 * File:      scripts/deploy-phase4.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Deploys all Phase 4 contracts:
 *   - TransferRestrictions (Reg D/S/A+ lockup + KYC)
 *   - GDPRManager (right-to-erasure, retention, legal holds)
 *
 * Run: npx hardhat run scripts/deploy-phase4.js --network <network>
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   AI Autonomous Notary Protocol — Phase 4 Deploy     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);

  const network = await ethers.provider.getNetwork();
  const deploymentsPath = path.join(__dirname, `../deployments/${network.name}.json`);
  const deployments = fs.existsSync(deploymentsPath)
    ? JSON.parse(fs.readFileSync(deploymentsPath)) : {};

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

  console.log("\n── Phase 4A: Transfer Restrictions ──\n");
  const TransferRestrictions = await ethers.getContractFactory("TransferRestrictions");
  await deploy("TransferRestrictions", TransferRestrictions, deployer.address);

  console.log("\n── Phase 4B: GDPR Manager ──\n");
  const GDPRManager = await ethers.getContractFactory("GDPRManager");
  await deploy(
    "GDPRManager",
    GDPRManager,
    deployer.address,   // admin
    deployer.address    // DPO — replace with DPO multi-sig in production
  );

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployments, null, 2));
  console.log(`\n💾 Saved to deployments/${network.name}.json`);
  console.log("\n✅ Phase 4 deployment complete!\n");
}

main().catch(err => { console.error(err); process.exit(1); });
