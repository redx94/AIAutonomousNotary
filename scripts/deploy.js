/**
 * ============================================================================
 * File:      deploy.js
 * Author:   Reece Dixon
 * Project:  AI Autonomous Notary Protocol
 * 
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
/**
 * @title AI Autonomous Notary Protocol — Deployment Script
 * @notice Deploys all Phase 1 contracts in dependency order,
 *         configures roles and inter-contract links, and saves
 *         deployment artifacts for verification and front-end use.
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║     AI Autonomous Notary Protocol — Phase 1 Deploy   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const [deployer, admin2, guardian] = await ethers.getSigners();
  console.log(`🔑 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const network = await ethers.provider.getNetwork();
  console.log(`🌐 Network: ${network.name} (chainId: ${network.chainId})\n`);

  const deployments = {};
  const startTime = Date.now();

  // ─── Helper ─────────────────────────────────────────────────────────────
  async function deploy(name, factory, ...args) {
    console.log(`📦 Deploying ${name}...`);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const receipt = await contract.deploymentTransaction().wait();
    const gasUsed = receipt.gasUsed;
    console.log(`   ✅ ${name}: ${address} (gas: ${gasUsed.toLocaleString()})`);
    deployments[name] = {
      address,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: gasUsed.toString(),
    };
    return contract;
  }

  // ─── 1. Deploy NotaryNFT ─────────────────────────────────────────────────
  console.log("\n── Phase 1A: Core Token Contracts ──\n");
  const NotaryNFT = await ethers.getContractFactory("NotaryNFT");
  const notaryNFT = await deploy("NotaryNFT", NotaryNFT, deployer.address);

  // ─── 2. Deploy DocumentSecurityToken (Example instance) ─────────────────
  const DocumentSecurityToken = await ethers.getContractFactory("DocumentSecurityToken");
  const exampleTokenParams = {
    name: "AI Notary Security Token",
    symbol: "ANST",
    documentHash: ethers.keccak256(ethers.toUtf8Bytes("genesis-document")),
    initialSupply: ethers.parseEther("10000000"),
    jurisdiction: "US",
    minimumInvestment: ethers.parseEther("1000"),
    notaryContract: await notaryNFT.getAddress(),
  };

  const documentSecurityToken = await deploy(
    "DocumentSecurityToken",
    DocumentSecurityToken,
    exampleTokenParams.name,
    exampleTokenParams.symbol,
    exampleTokenParams.documentHash,
    exampleTokenParams.initialSupply,
    exampleTokenParams.jurisdiction,
    exampleTokenParams.minimumInvestment,
    exampleTokenParams.notaryContract
  );

  // ─── 3. Deploy DocumentRegistry ─────────────────────────────────────────
  console.log("\n── Phase 1B: Registry & Access Control ──\n");
  const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
  const documentRegistry = await deploy("DocumentRegistry", DocumentRegistry, deployer.address);

  // ─── 4. Deploy NotaryAccessControl ──────────────────────────────────────
  const admins = admin2
    ? [deployer.address, admin2.address]
    : [deployer.address, deployer.address]; // Use same address if only one signer

  const NotaryAccessControl = await ethers.getContractFactory("NotaryAccessControl");
  const notaryAccessControl = await deploy(
    "NotaryAccessControl", NotaryAccessControl, admins, 2n
  );

  // ─── 5. Deploy EmergencyProtocol ─────────────────────────────────────────
  console.log("\n── Phase 1C: Security Infrastructure ──\n");
  const guardianAddr = guardian ? guardian.address : deployer.address;
  const EmergencyProtocol = await ethers.getContractFactory("EmergencyProtocol");
  const emergencyProtocol = await deploy(
    "EmergencyProtocol", EmergencyProtocol, deployer.address, [guardianAddr]
  );

  // ─── 6. Deploy AIEngine ──────────────────────────────────────────────────
  console.log("\n── Phase 1D: AI Oracle Infrastructure ──\n");
  // For local deployment, use deployer as initial oracle
  // In production, these would be separate trusted oracle node addresses
  const initialOracles = [deployer.address];

  const AIEngine = await ethers.getContractFactory("AIEngine");
  const aiEngine = await deploy("AIEngine", AIEngine, deployer.address, initialOracles);

  // ─── 7. Deploy OracleManager ────────────────────────────────────────────
  const OracleManager = await ethers.getContractFactory("OracleManager");
  const oracleManager = await deploy("OracleManager", OracleManager, deployer.address);

  // ─── 8. Deploy ValidationOracle ─────────────────────────────────────────
  const ValidationOracle = await ethers.getContractFactory("ValidationOracle");
  const validationOracle = await deploy(
    "ValidationOracle", ValidationOracle, deployer.address, initialOracles
  );

  // ─── 9. Deploy ConditionalAccess ─────────────────────────────────────────
  console.log("\n── Phase 1E: Conditional Access & Fractionalization ──\n");
  const ConditionalAccess = await ethers.getContractFactory("ConditionalAccess");
  const conditionalAccess = await deploy(
    "ConditionalAccess", ConditionalAccess, deployer.address, deployer.address
  );

  // Grant oracle role on ConditionalAccess to the deployer (fleshed out with real oracle nodes later)
  const CA_ORACLE_ROLE = await conditionalAccess.ORACLE_ROLE();
  await (await conditionalAccess.grantRole(CA_ORACLE_ROLE, deployer.address)).wait();
  console.log("   ✅ ConditionalAccess oracle role granted");

  // Note: FractionalizationVault is deployed on-demand per NFT token, not globally.
  // The deploy script demonstrates a template deployment for documentation purposes.
  console.log("   ℹ️  FractionalizationVault: deployed per-token by NFT owners (no global address)");

  // ─── Configure Roles & Links ─────────────────────────────────────────────
  console.log("\n── Configuring Inter-Contract Roles ──\n");

  // DocumentRegistry -> grant notary and validator roles
  const DR_NOTARY_ROLE    = await documentRegistry.NOTARY_ROLE();
  const DR_VALIDATOR_ROLE = await documentRegistry.VALIDATOR_ROLE();
  await (await documentRegistry.grantRole(DR_NOTARY_ROLE,    deployer.address)).wait();
  await (await documentRegistry.grantRole(DR_VALIDATOR_ROLE, deployer.address)).wait();
  console.log("   ✅ DocumentRegistry roles configured");

  // AIEngine -> grant requestor role to deployer
  const AE_REQUESTOR_ROLE = await aiEngine.REQUESTOR_ROLE();
  await (await aiEngine.grantRole(AE_REQUESTOR_ROLE, deployer.address)).wait();
  console.log("   ✅ AIEngine requestor role granted");

  // OracleManager -> grant consumer role to deployer and AIEngine
  const OM_CONSUMER_ROLE = await oracleManager.CONSUMER_ROLE();
  await (await oracleManager.grantRole(OM_CONSUMER_ROLE, deployer.address)).wait();
  await (await oracleManager.grantRole(OM_CONSUMER_ROLE, await aiEngine.getAddress())).wait();
  console.log("   ✅ OracleManager consumer roles granted");

  // Register contracts with EmergencyProtocol circuit breaker
  await (await emergencyProtocol.registerContract(await notaryNFT.getAddress(), "NotaryNFT")).wait();
  await (await emergencyProtocol.registerContract(await documentRegistry.getAddress(), "DocumentRegistry")).wait();
  await (await emergencyProtocol.registerContract(await aiEngine.getAddress(), "AIEngine")).wait();
  await (await emergencyProtocol.registerContract(await oracleManager.getAddress(), "OracleManager")).wait();
  await (await emergencyProtocol.registerContract(await validationOracle.getAddress(), "ValidationOracle")).wait();
  console.log("   ✅ Circuit breakers registered");

  // Register a sample ETH/USD price feed in OracleManager
  const ETH_USD_FEED = ethers.keccak256(ethers.toUtf8Bytes("ETH_USD"));
  await (await oracleManager.registerFeed(
    ETH_USD_FEED, "ETH/USD", "Ethereum price in USD", 0,
    deployer.address, ethers.ZeroAddress, 3600n, 7200n, 500n, 8
  )).wait();
  console.log("   ✅ ETH/USD oracle feed registered");

  // ─── Save Deployment Artifacts ───────────────────────────────────────────
  const artifact = {
    network: { name: network.name, chainId: network.chainId.toString() },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployments,
    configuration: {
      multiSigThreshold: 2,
      initialOracles: initialOracles,
      guardians: [guardianAddr],
      oracleFeeds: { ETH_USD: ETH_USD_FEED },
    },
  };

  const artifactsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const filename = `phase1_${network.name}_${Date.now()}.json`;
  const filepath = path.join(artifactsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(artifact, null, 2));
  console.log(`\n📄 Deployment saved to: ${filepath}`);

  // ─── Summary ────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║              📋 DEPLOYMENT SUMMARY                    ║");
  console.log("╠══════════════════════════════════════════════════════╣");

  Object.entries(deployments).forEach(([name, info]) => {
    const padded = name.padEnd(26);
    console.log(`║  ${padded} ${info.address.slice(0, 22)}...  ║`);
  });

  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  ⏱  Deployment time: ${elapsed}s                         ║`);
  console.log(`║  🔢 Contracts: ${Object.keys(deployments).length}                                  ║`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log("🎉 Phase 1 deployment complete!\n");
  console.log("📋 Verification commands:");
  Object.entries(deployments).forEach(([name, info]) => {
    console.log(`   npx hardhat verify --network ${network.name} ${info.address}`);
  });

  return artifact;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
