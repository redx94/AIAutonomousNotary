/**
 * ============================================================================
 * File:      scripts/deploy-phase2.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Deploys all Phase 2 contracts:
 *   - NotaryToken ($NOTARY ERC-20Votes)
 *   - Treasury (protocol treasury)
 *   - DocumentMarketplace (CLOB order book)
 *   - AMM (constant-product AMM)
 *   - AuctionHouse (English/Dutch auctions)
 *   - LendingProtocol (document-backed lending)
 *
 * Requires Phase 1 deployment artifacts in deployments/<network>.json.
 * Run: npx hardhat run scripts/deploy-phase2.js --network <network>
 */

const { ethers } = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   AI Autonomous Notary Protocol — Phase 2 Deploy     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const [deployer, admin2, guardian] = await ethers.getSigners();
  console.log(`🔑 Deployer:  ${deployer.address}`);
  console.log(`💰 Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const network = await ethers.provider.getNetwork();
  console.log(`🌐 Network:   ${network.name} (chainId: ${network.chainId})\n`);

  // Load Phase 1 deployments
  const deploymentsPath = path.join(__dirname, `../deployments/${network.name}.json`);
  let phase1 = {};
  if (fs.existsSync(deploymentsPath)) {
    phase1 = JSON.parse(fs.readFileSync(deploymentsPath));
    console.log("📋 Loaded Phase 1 deployment addresses\n");
  } else {
    console.warn("⚠️  No Phase 1 deployment found — proceeding with zero-address placeholders\n");
  }

  const deployments = { ...phase1 };

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

  // ─── 1. Deploy Treasury first (needed by marketplace/AMM/etc.) ──────────
  console.log("\n── Phase 2A: Treasury & Token ──\n");

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await deploy(
    "Treasury",
    Treasury,
    deployer.address,              // admin (will be replaced by multi-sig in production)
    ethers.parseEther("0.5"),      // smallSpendLimit: 0.5 ETH
    2n                             // requiredApprovals: 2
  );
  const treasuryAddr = await treasury.getAddress();

  // ─── 2. Deploy NotaryToken ───────────────────────────────────────────────

  // Token allocation addresses (use deployer for testnet simplicity)
  // In production: separate vesting contracts, liquidity address, etc.
  const NotaryToken = await ethers.getContractFactory("NotaryToken");
  const notaryToken = await deploy(
    "NotaryToken",
    NotaryToken,
    deployer.address,  // admin
    treasuryAddr,      // treasury   → 25M
    deployer.address,  // ecosystem  → 20M (replace with emissions contract)
    deployer.address,  // teamVesting → 20M (replace with vesting contract)
    deployer.address,  // investorVesting → 15M (replace with vesting contract)
    deployer.address,  // liquidity  → 10M (replace with LP bootstrapping address)
    deployer.address   // reserve    → 10M
  );

  // ─── 3. Marketplace contracts ────────────────────────────────────────────
  console.log("\n── Phase 2B: Marketplace Layer ──\n");

  const DocumentMarketplace = await ethers.getContractFactory("DocumentMarketplace");
  const marketplace = await deploy(
    "DocumentMarketplace",
    DocumentMarketplace,
    deployer.address,   // admin
    treasuryAddr,       // fee recipient
    50n                 // feeBP: 0.5%
  );

  const AMM = await ethers.getContractFactory("AMM");
  const amm = await deploy(
    "AMM",
    AMM,
    deployer.address,   // admin
    treasuryAddr,       // fee treasury
    2000n               // protocolFeeBP: 20% of swap fees
  );

  const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await deploy(
    "AuctionHouse",
    AuctionHouse,
    deployer.address,   // admin
    treasuryAddr,       // fee treasury
    200n                // feeBP: 2%
  );

  // ─── 4. Lending protocol ─────────────────────────────────────────────────
  console.log("\n── Phase 2C: Lending Protocol ──\n");

  const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
  const lending = await deploy(
    "LendingProtocol",
    LendingProtocol,
    deployer.address,   // admin
    treasuryAddr,       // fee treasury
    1000n               // protocolFeeBP: 10% of interest
  );

  // ─── 5. Grant REVENUE_DEPOSITOR role to marketplace contracts ────────────
  console.log("\n── Configuring inter-contract permissions ──\n");

  const REVENUE_DEPOSITOR = ethers.keccak256(ethers.toUtf8Bytes("REVENUE_DEPOSITOR"));
  const marketplaceAddr   = await marketplace.getAddress();
  const ammAddr           = await amm.getAddress();
  const auctionAddr       = await auctionHouse.getAddress();
  const lendingAddr       = await lending.getAddress();

  for (const [name, addr] of [
    ["DocumentMarketplace", marketplaceAddr],
    ["AMM",                 ammAddr],
    ["AuctionHouse",        auctionAddr],
    ["LendingProtocol",     lendingAddr],
  ]) {
    await (await treasury.grantRole(REVENUE_DEPOSITOR, addr)).wait();
    console.log(`   ✅ Granted REVENUE_DEPOSITOR to ${name}`);
  }

  // ─── Save deployments ────────────────────────────────────────────────────
  console.log("\n── Saving deployment artifacts ──\n");

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, `${network.name}.json`),
    JSON.stringify(deployments, null, 2)
  );
  console.log(`💾 Saved to deployments/${network.name}.json`);

  console.log("\n✅ Phase 2 deployment complete!\n");
  console.log("Contract addresses:");
  for (const [name, info] of Object.entries(deployments)) {
    if (info.address) console.log(`   ${name}: ${info.address}`);
  }
}

main().catch(err => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
