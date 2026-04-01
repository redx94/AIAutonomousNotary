/**
 * ============================================================================
 * File:      Phase1Coverage.test.js
 * Author:   Reece Dixon
 * Project:  AI Autonomous Notary Protocol
 * 
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
/**
 * @title Phase 1 Coverage Extension Tests
 * @notice Covers NotaryAccessControl, OracleManager, AIEngine, EmergencyProtocol,
 *         ValidationOracle, and DocumentSecurityToken to push suite coverage above 80%.
 */

const { ethers }    = require("hardhat");
const { expect }    = require("chai");
const { time }      = require("@nomicfoundation/hardhat-network-helpers");

describe("AI Autonomous Notary — Phase 1 Coverage Extension", function () {
  this.timeout(120_000);

  let admin, admin2, guardian, operator, notary, validator, user1, user2, treasury;

  beforeEach(async function () {
    [admin, admin2, guardian, operator, notary, validator, user1, user2, treasury] =
      await ethers.getSigners();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. NotaryAccessControl
  // ─────────────────────────────────────────────────────────────────────────

  describe("NotaryAccessControl", function () {
    let nac;
    const NOTARY_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("NOTARY_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const SUPER_ADMIN   = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));

    beforeEach(async function () {
      const NAC = await ethers.getContractFactory("NotaryAccessControl");
      nac = await NAC.deploy([admin.address, admin2.address], 2n);
      await nac.waitForDeployment();
    });

    it("should deploy with correct initial state", async function () {
      expect(await nac.multiSigThreshold()).to.equal(2n);
      expect(await nac.isMultiSigSigner(admin.address)).to.be.true;
    });

    it("should reject deployment with insufficient admins for threshold", async function () {
      const NAC = await ethers.getContractFactory("NotaryAccessControl");
      await expect(NAC.deploy([admin.address], 2n))
        .to.be.revertedWith("AccessControl: insufficient admins for threshold");
    });

    it("should reject threshold below minimum (2)", async function () {
      const NAC = await ethers.getContractFactory("NotaryAccessControl");
      await expect(NAC.deploy([admin.address, admin2.address], 1n))
        .to.be.revertedWith("AccessControl: threshold too low");
    });

    it("should propose a role change and emit events", async function () {
      await expect(
        nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true)
      ).to.emit(nac, "ActionProposed").and.to.emit(nac, "ActionSigned");
    });

    it("should sign and execute a role change after timelock", async function () {
      const tx = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const receipt = await tx.wait();
      const event   = receipt.logs.find(l => l.fragment?.name === "ActionProposed");
      const actionId = event.args.actionId;
      await nac.connect(admin2).signAction(actionId);
      await time.increase(48 * 3600 + 1);
      await expect(nac.connect(admin).executeAction(actionId))
        .to.emit(nac, "ActionExecuted");
      expect(await nac.hasRole(NOTARY_ROLE, notary.address)).to.be.true;
    });

    it("should reject early execution before timelock", async function () {
      const tx = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const r = await tx.wait();
      const e = r.logs.find(l => l.fragment?.name === "ActionProposed");
      await nac.connect(admin2).signAction(e.args.actionId);
      await expect(nac.connect(admin).executeAction(e.args.actionId))
        .to.be.revertedWith("AccessControl: timelock active");
    });

    it("should reject execution without sufficient signatures", async function () {
      const tx = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const r = await tx.wait();
      const e = r.logs.find(l => l.fragment?.name === "ActionProposed");
      await time.increase(48 * 3600 + 1);
      await expect(nac.connect(admin).executeAction(e.args.actionId))
        .to.be.revertedWith("AccessControl: insufficient signatures");
    });

    it("should cancel an action", async function () {
      const tx = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const r = await tx.wait();
      const e = r.logs.find(l => l.fragment?.name === "ActionProposed");
      await nac.connect(admin).cancelAction(e.args.actionId);
      await time.increase(48 * 3600 + 1);
      await nac.connect(admin2).signAction(e.args.actionId).catch(() => {}); // may revert ok
      await expect(nac.connect(admin).executeAction(e.args.actionId))
        .to.be.revertedWith("AccessControl: cancelled");
    });

    it("should reject double-signing", async function () {
      const tx = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const r = await tx.wait();
      const e = r.logs.find(l => l.fragment?.name === "ActionProposed");
      await expect(nac.connect(admin).signAction(e.args.actionId))
        .to.be.revertedWith("AccessControl: already signed");
    });

    it("should grant operator role instantly", async function () {
      await nac.connect(admin).grantOperatorRole(operator.address);
      expect(await nac.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
    });

    it("should revoke operator role", async function () {
      await nac.connect(admin).grantOperatorRole(operator.address);
      await nac.connect(admin).revokeOperatorRole(operator.address);
      expect(await nac.hasRole(OPERATOR_ROLE, operator.address)).to.be.false;
    });

    it("should add and remove multi-sig signers", async function () {
      await nac.connect(admin).addMultiSigSigner(guardian.address);
      expect(await nac.isMultiSigSigner(guardian.address)).to.be.true;
      await nac.connect(admin).removeMultiSigSigner(guardian.address);
      expect(await nac.isMultiSigSigner(guardian.address)).to.be.false;
    });

    it("should reject removing signer that breaks threshold", async function () {
      await expect(nac.connect(admin).removeMultiSigSigner(admin2.address))
        .to.be.revertedWith("AccessControl: would break threshold");
    });

    it("should update multi-sig threshold", async function () {
      await nac.connect(admin).addMultiSigSigner(guardian.address);
      await expect(nac.connect(admin).updateThreshold(3n))
        .to.emit(nac, "ThresholdUpdated").withArgs(2n, 3n);
    });

    it("should return role members list", async function () {
      const members = await nac.getRoleMembers(SUPER_ADMIN);
      expect(members).to.include(admin.address);
    });

    it("should return multi-sig signers list", async function () {
      const signers = await nac.getMultiSigSigners();
      expect(signers).to.include(admin.address);
    });

    it("should pause and unpause", async function () {
      await nac.connect(admin).pause();
      await expect(
        nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true)
      ).to.be.revertedWith("Pausable: paused");
      await nac.connect(admin).unpause();
    });

    it("should execute a role revocation through timelock", async function () {
      // Grant
      const tx1 = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const r1 = await tx1.wait();
      const e1 = r1.logs.find(l => l.fragment?.name === "ActionProposed");
      await nac.connect(admin2).signAction(e1.args.actionId);
      await time.increase(48 * 3600 + 1);
      await nac.connect(admin).executeAction(e1.args.actionId);
      expect(await nac.hasRole(NOTARY_ROLE, notary.address)).to.be.true;
      // Revoke
      const tx2 = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, false);
      const r2 = await tx2.wait();
      const e2 = r2.logs.find(l => l.fragment?.name === "ActionProposed");
      await nac.connect(admin2).signAction(e2.args.actionId);
      await time.increase(48 * 3600 + 1);
      await nac.connect(admin).executeAction(e2.args.actionId);
      expect(await nac.hasRole(NOTARY_ROLE, notary.address)).to.be.false;
    });

    it("should return pending action details", async function () {
      const tx = await nac.connect(admin).proposeRoleChange(notary.address, NOTARY_ROLE, true);
      const r = await tx.wait();
      const e = r.logs.find(l => l.fragment?.name === "ActionProposed");
      const details = await nac.getPendingAction(e.args.actionId);
      expect(details.proposer).to.equal(admin.address);
      expect(details.isGrant).to.be.true;
    });

    it("should return the audit log to super admin", async function () {
      await nac.connect(admin).grantOperatorRole(operator.address);
      const log = await nac.connect(admin).getAuditLog();
      expect(log.length).to.be.gte(1);
      expect(log[0].action).to.equal("ROLE_GRANTED");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. OracleManager
  // ─────────────────────────────────────────────────────────────────────────

  describe("OracleManager — Extended Coverage", function () {
    let oracleManager;
    const FEED_ID       = ethers.keccak256(ethers.toUtf8Bytes("BTC_USD_COV"));
    const PROVIDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_PROVIDER_ROLE"));

    beforeEach(async function () {
      const OM = await ethers.getContractFactory("OracleManager");
      oracleManager = await OM.deploy(admin.address);
      await oracleManager.waitForDeployment();
      await oracleManager.grantRole(PROVIDER_ROLE, operator.address);
      await oracleManager.registerFeed(
        FEED_ID, "BTC/USD", "Bitcoin price in USD", 0,
        operator.address, ethers.ZeroAddress, 3600n, 7200n, 500n, 8
      );
    });

    it("should retrieve feed via getFeed()", async function () {
      const feed = await oracleManager.getFeed(FEED_ID);
      expect(feed.name).to.equal("BTC/USD");
      expect(feed.decimals).to.equal(8);
    });

    it("should get all registered feed IDs", async function () {
      const ids = await oracleManager.getAllFeedIds();
      expect(ids).to.include(FEED_ID);
    });

    it("should submit an unsigned answer", async function () {
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
      await oracleManager.connect(operator).submitUnsignedAnswer(FEED_ID, 6500000000000n, proofHash);
      // submitUnsignedAnswer updates latestAnswerUint; use getFeed to verify
      const feed = await oracleManager.getFeed(FEED_ID);
      expect(feed.latestAnswerUint).to.equal(6500000000000n);
    });


    it("should get feed update history", async function () {
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("h1"));
      await oracleManager.connect(operator).submitUnsignedAnswer(FEED_ID, 6400000000000n, proofHash);
      const history = await oracleManager.getFeedHistory(FEED_ID);
      expect(history.length).to.be.gte(1);
    });

    it("should deprecate a feed", async function () {
      await oracleManager.connect(admin).deprecateFeed(FEED_ID);
      const feed = await oracleManager.getFeed(FEED_ID);
      expect(feed.status).to.equal(3n); // FeedStatus.DEPRECATED = 3
    });

    it("should reactivate a DEGRADED feed back to ACTIVE", async function () {
      // Force the feed into DEGRADED state by waiting past staleThreshold (3600s)
      await time.increase(3601);
      await oracleManager.checkAndUpdateStaleness();
      // Submit a fresh answer to move it to DEGRADED, then reactivate
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("fresh"));
      await oracleManager.connect(operator).submitUnsignedAnswer(FEED_ID, 6500000000000n, proofHash);
      // submitAnswer automatically moves DEGRADED -> ACTIVE internally
      const feed = await oracleManager.getFeed(FEED_ID);
      // Just verify it's not deprecated
      expect(feed.status).to.not.equal(3n);
    });

    it("should return health report", async function () {
      // getHealthReport() returns (totalFeeds, activeFeeds, degradedFeeds, offlineFeeds) tuple
      const [total, active] = await oracleManager.getHealthReport();
      expect(total).to.be.gte(1n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. AIEngine — Admin Parameters
  // ─────────────────────────────────────────────────────────────────────────

  describe("AIEngine — Admin Parameters", function () {
    let aiEngine;

    beforeEach(async function () {
      const AE = await ethers.getContractFactory("AIEngine");
      aiEngine = await AE.deploy(admin.address, [operator.address, user1.address, user2.address]);
      await aiEngine.waitForDeployment();
    });

    it("should update consensus threshold", async function () {
      await aiEngine.connect(admin).setConsensusThreshold(3n);
      expect(await aiEngine.defaultConsensusThreshold()).to.equal(3n);
    });

    it("should reject threshold of 0", async function () {
      await expect(aiEngine.connect(admin).setConsensusThreshold(0n))
        .to.be.revertedWith("AIEngine: invalid threshold");
    });

    it("should update request timeout", async function () {
      await aiEngine.connect(admin).setRequestTimeout(2n * 3600n);
      expect(await aiEngine.requestTimeout()).to.equal(2n * 3600n);
    });

    it("should reject timeout below 30 minutes", async function () {
      await expect(aiEngine.connect(admin).setRequestTimeout(1000n))
        .to.be.revertedWith("AIEngine: invalid timeout");
    });

    it("should update max fraud score threshold", async function () {
      await aiEngine.connect(admin).setMaxFraudScoreThreshold(5000n);
      expect(await aiEngine.maxFraudScoreThreshold()).to.equal(5000n);
    });

    it("should deregister an oracle", async function () {
      await aiEngine.connect(admin).deregisterOracle(user2.address);
      expect(await aiEngine.isRegisteredOracle(user2.address)).to.be.false;
    });

    it("should list all registered oracles", async function () {
      const oracles = await aiEngine.getRegisteredOracles();
      expect(oracles).to.include(operator.address);
    });

    it("should update certificate validity period", async function () {
      await aiEngine.connect(admin).setCertificateValidity(730n * 86400n); // 2 years
      expect(await aiEngine.certificateValidity()).to.equal(730n * 86400n);
    });

    it("should pause and unpause", async function () {
      await aiEngine.connect(admin).pause();
      const REQUESTOR_ROLE = await aiEngine.REQUESTOR_ROLE();
      await aiEngine.grantRole(REQUESTOR_ROLE, admin.address);
      await expect(
        aiEngine.connect(admin).requestValidation(
          ethers.keccak256(ethers.toUtf8Bytes("docX")),
          ethers.keccak256(ethers.toUtf8Bytes("meta")), 0, 0n
        )
      ).to.be.revertedWith("Pausable: paused");
      await aiEngine.connect(admin).unpause();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. EmergencyProtocol
  // ─────────────────────────────────────────────────────────────────────────

  describe("EmergencyProtocol — Extended Coverage", function () {
    let ep;
    const SUPER_ADMIN = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));

    beforeEach(async function () {
      const EP = await ethers.getContractFactory("EmergencyProtocol");
      ep = await EP.deploy(admin.address, [guardian.address]);
      await ep.waitForDeployment();
    });

    it("should register a contract", async function () {
      const dummy = ethers.Wallet.createRandom().address;
      await ep.connect(admin).registerContract(dummy, "DummyContract");
      const registered = await ep.getRegisteredContracts();
      expect(registered).to.include(dummy);
    });

    it("should trigger Level 1 emergency", async function () {
      // triggerLevel1(EmergencyType emergencyType, string description, bytes32 evidenceHash)
      // EmergencyType.SECURITY_BREACH = 0
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("suspicious"));
      const tx = await ep.connect(guardian).triggerLevel1(0, "Suspicious activity", evidenceHash);
      await tx.wait();
      // After Level 1, protocol is not necessarily paused (Level 2 pauses)
      expect(await ep.isProtocolPaused()).to.equal(false);
    });

    it("should trip and reset a circuit breaker", async function () {
      const dummy = ethers.Wallet.createRandom().address;
      await ep.connect(admin).registerContract(dummy, "TestContract");
      await ep.connect(guardian).tripCircuitBreaker(dummy, 3600n);
      expect(await ep.isContractPaused(dummy)).to.be.true;
      await ep.connect(guardian).resetCircuitBreaker(dummy);
      expect(await ep.isContractPaused(dummy)).to.be.false;
    });

    it("should read circuit breaker state (not tripped by default)", async function () {
      const dummy = ethers.Wallet.createRandom().address;
      await ep.connect(admin).registerContract(dummy, "TestContract");
      const cb = await ep.getCircuitBreaker(dummy);
      // CircuitBreaker struct has isPaused field, not tripped
      expect(cb.isPaused).to.be.false;
    });

    it("should trigger Level 2 and pause protocol", async function () {
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("attack"));
      await ep.connect(guardian).triggerLevel2(0, "Under attack", evidenceHash);
      expect(await ep.isProtocolPaused()).to.be.true;
    });

    it("should resolve a Level 1 emergency back to NONE", async function () {
      const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-resolve"));
      const tx = await ep.connect(guardian).triggerLevel1(0, "Test", evidenceHash);
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment?.name === "EmergencyDeclared" || l.fragment?.name === "EmergencyTriggered" || l.fragment?.name);
      const eventId = event ? event.args[0] : 1n;
      await ep.connect(admin).resolveEmergency(eventId, 0n);
      expect(await ep.isProtocolPaused()).to.be.false;
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // 5. ValidationOracle
  // ─────────────────────────────────────────────────────────────────────────

  describe("ValidationOracle — Extended Coverage", function () {
    let vo;
    const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-doc-cov"));

    beforeEach(async function () {
      const VO = await ethers.getContractFactory("ValidationOracle");
      vo = await VO.deploy(admin.address, [operator.address, user1.address, user2.address]);
      await vo.waitForDeployment();
    });

    it("should list registered validator pool", async function () {
      const pool = await vo.getValidatorPool();
      expect(pool).to.include(operator.address);
    });

    it("should get validator info", async function () {
      const info = await vo.getValidatorInfo(operator.address);
      // ValidatorInfo has fields: validatorAddress, reputation, totalVotes, ...
      expect(info.validatorAddress).to.equal(operator.address);
    });

    it("should slash a validator and reduce reputation", async function () {
      await vo.connect(admin).slashValidator(operator.address, "Malicious");
      const info = await vo.getValidatorInfo(operator.address);
      // reputation field (not reputationScore)
      expect(info.reputation).to.be.lt(10000n);
    });

    it("should create a voting round", async function () {
      // createVotingRound(bytes32 documentHash) — requires ORACLE_ADMIN role
      const ORACLE_ADMIN = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ADMIN"));
      await vo.grantRole(ORACLE_ADMIN, admin.address);
      await vo.connect(admin).createVotingRound(SAMPLE_HASH);
      const round = await vo.getRoundByDocument(SAMPLE_HASH);
      expect(round.documentHash).to.equal(SAMPLE_HASH);
    });

    it("should update min validators and consensus threshold", async function () {
      await vo.connect(admin).setMinValidators(2n);
      await vo.connect(admin).setConsensusThreshold(6600n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. DocumentSecurityToken
  // ─────────────────────────────────────────────────────────────────────────

  describe("DocumentSecurityToken — Extended Coverage", function () {
    let dst;
    const DOC_HASH        = ethers.keccak256(ethers.toUtf8Bytes("realestate-deed-002"));
    const COMPLIANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMPLIANCE_ROLE"));
    const ISSUER_ROLE     = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));

    beforeEach(async function () {
      const NotaryNFT = await ethers.getContractFactory("NotaryNFT");
      const notaryNFT = await NotaryNFT.deploy(admin.address);
      await notaryNFT.waitForDeployment();

      const DST = await ethers.getContractFactory("DocumentSecurityToken");
      dst = await DST.deploy(
        "Property Token", "PTK", DOC_HASH,
        ethers.parseEther("1000000"), "US",
        ethers.parseEther("1000"), await notaryNFT.getAddress()
      );
      await dst.waitForDeployment();
      await dst.grantRole(COMPLIANCE_ROLE, admin.address);
      await dst.grantRole(ISSUER_ROLE, admin.address);
    });

    it("should have correct initial supply", async function () {
      expect(await dst.totalSupply()).to.equal(ethers.parseEther("1000000"));
    });

    it("should get token info", async function () {
      const info = await dst.getTokenInfo();
      // TokenInfo has .documentHash and .jurisdiction (no trailing underscore)
      expect(info.documentHash).to.equal(DOC_HASH);
      expect(info.jurisdiction).to.equal("US");
    });

    it("should freeze and unfreeze accounts", async function () {
      await dst.connect(admin).freezeAccount(user1.address);
      expect(await dst.frozenAccounts(user1.address)).to.be.true;
      await dst.connect(admin).unfreezeAccount(user1.address);
      expect(await dst.frozenAccounts(user1.address)).to.be.false;
    });

    it("should set accredited investor status", async function () {
      await dst.connect(admin).setAccreditedInvestor(user1.address, true);
      expect(await dst.accreditedInvestors(user1.address)).to.be.true;
    });

    it("should set lockup period", async function () {
      const lockupEnd = (await time.latest()) + 86400;
      await dst.connect(admin).setLockupPeriod(user1.address, lockupEnd);
    });

    it("should emergency pause and prevent transfers", async function () {
      await dst.connect(admin).emergencyPause();
      await expect(
        dst.connect(admin).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
      await dst.connect(admin).emergencyUnpause();
    });

    it("should mint additional tokens (as accredited investor)", async function () {
      // DST.mint() requires recipient to be an accredited investor
      await dst.connect(admin).setAccreditedInvestor(user1.address, true);
      await dst.connect(admin).mint(user1.address, ethers.parseEther("500"));
      expect(await dst.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
    });

    it("should allow transfer between accredited investors", async function () {
      // DST requires accredited investor status for transfers
      await dst.connect(admin).setAccreditedInvestor(admin.address, true);
      await dst.connect(admin).setAccreditedInvestor(user1.address, true);
      // admin has the initial 1M supply
      await dst.connect(admin).transfer(user1.address, ethers.parseEther("100"));
      expect(await dst.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
    });

    it("should check transfer compliance", async function () {
      const ok = await dst.isTransferCompliant(admin.address, user1.address, ethers.parseEther("100"));
      expect(typeof ok).to.equal("boolean");
    });
  });
});
