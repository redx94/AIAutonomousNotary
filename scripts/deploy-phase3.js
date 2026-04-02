/**
 * ============================================================================
 * File:      scripts/deploy-phase3.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Deploys all Phase 3 contracts:
 *   - NLPEngine (NLP validation oracle coordinator)
 *   - FraudDetection (anomaly-scoring fraud registry)
 *   - ZKProof (zero-knowledge proof verifier)
 *
 * Run: npx hardhat run scripts/deploy-phase3.js --network <network>
 */

const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   AI Autonomous Notary Protocol — Phase 3 Deploy     ║");
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

  console.log("\n── Phase 3A: NLP Engine ──\n");
  const NLPEngine = await ethers.getContractFactory("NLPEngine");
  const nlpEngine = await deploy("NLPEngine", NLPEngine, deployer.address, 1n);

  console.log("\n── Phase 3B: Fraud Detection ──\n");
  const FraudDetection = await ethers.getContractFactory("FraudDetection");
  const fraudDetection = await deploy("FraudDetection", FraudDetection, deployer.address);

  console.log("\n── Phase 3C: ZK Proof Verifier ──\n");
  const ZKProof = await ethers.getContractFactory("ZKProof");
  const zkProof = await deploy(
    "ZKProof",
    ZKProof,
    deployer.address,
    30 * 24 * 60 * 60n  // 30-day default proof TTL
  );

  // Grant requester role to deployer (will be granted to API service in production)
  await (await nlpEngine.grantRole(
    ethers.keccak256(ethers.toUtf8Bytes("REQUESTER_ROLE")),
    deployer.address
  )).wait();
  console.log("\n   ✅ Granted REQUESTER_ROLE to deployer on NLPEngine");

  // Save
  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployments, null, 2));
  console.log(`\n💾 Saved to deployments/${network.name}.json`);
  console.log("\n✅ Phase 3 deployment complete!\n");
}

main().catch(err => { console.error(err); process.exit(1); });
