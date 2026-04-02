/**
 * ============================================================================
 * File:      test/Phase5.test.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Phase 5 contract tests: Governance, Treasury, JurisdictionManager
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY  = 86_400n;
const HOUR = 3_600n;

// Deploy a minimal NotaryToken with all allocations going to the same address
// so tests can control voting power.
async function deployToken(admin) {
  const Factory = await ethers.getContractFactory("NotaryToken");
  return Factory.deploy(
    admin.address, // admin
    admin.address, // treasury
    admin.address, // ecosystem
    admin.address, // liquidity
    admin.address, // reserve
    admin.address, // teamVesting
    admin.address  // investorVesting
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance
// ─────────────────────────────────────────────────────────────────────────────

describe("Governance", () => {
  let gov, token;
  let admin, executor, guardian, voter1, voter2, nonHolder;

  // Fixed parameters used across tests
  const VOTING_DELAY  = 2n * DAY;
  const VOTING_PERIOD = 7n * DAY;
  const THRESHOLD     = ethers.parseEther("100000"); // 100 k NOTARY
  const QUORUM_BP     = 400n;                         // 4 %

  before(async () => {
    [admin, executor, guardian, voter1, voter2, nonHolder] = await ethers.getSigners();

    token = await deployToken(admin);

    const Factory = await ethers.getContractFactory("Governance");
    gov = await Factory.deploy(
      admin.address,
      await token.getAddress(),
      VOTING_DELAY,
      VOTING_PERIOD,
      THRESHOLD,
      QUORUM_BP
    );

    // Grant executor and guardian roles
    await gov.grantRole(await gov.EXECUTOR_ROLE(),  executor.address);
    await gov.grantRole(await gov.GUARDIAN_ROLE(),  guardian.address);

    // Distribute voting power: admin holds all supply; delegate to self + voter1/voter2
    await token.delegate(admin.address);

    // Transfer some to voter1 and voter2 so they can cast votes
    await token.transfer(voter1.address, ethers.parseEther("1000000")); // 1 M
    await token.transfer(voter2.address, ethers.parseEther("500000"));  // 500 k

    await token.connect(voter1).delegate(voter1.address);
    await token.connect(voter2).delegate(voter2.address);
  });

  // ── Deployment ────────────────────────────────────────────────────────────

  it("stores constructor parameters correctly", async () => {
    expect(await gov.votingDelay()).to.equal(VOTING_DELAY);
    expect(await gov.votingPeriod()).to.equal(VOTING_PERIOD);
    expect(await gov.proposalThreshold()).to.equal(THRESHOLD);
    expect(await gov.quorumBP()).to.equal(QUORUM_BP);
    expect(await gov.votingToken()).to.equal(await token.getAddress());
  });

  it("admin holds GOV_ADMIN, EXECUTOR_ROLE, GUARDIAN_ROLE", async () => {
    expect(await gov.hasRole(await gov.GOV_ADMIN(),      admin.address)).to.be.true;
    expect(await gov.hasRole(await gov.EXECUTOR_ROLE(),  admin.address)).to.be.true;
    expect(await gov.hasRole(await gov.GUARDIAN_ROLE(),  admin.address)).to.be.true;
  });

  it("quorumVotes equals 4% of total supply", async () => {
    const supply = await token.totalSupply();
    const expected = (supply * QUORUM_BP) / 10_000n;
    expect(await gov.quorumVotes()).to.equal(expected);
  });

  // ── Propose ───────────────────────────────────────────────────────────────

  it("reverts proposal from account below threshold", async () => {
    // nonHolder has 0 tokens
    await expect(
      gov.connect(nonHolder).propose(
        6, // ProposalCategory.OTHER
        "Test proposal",
        "ipfs://QmTest",
        ethers.ZeroAddress,
        "0x",
        0,
        false
      )
    ).to.be.revertedWith("Governance: insufficient voting power");
  });

  let proposalId;

  it("admin can create a proposal", async () => {
    const tx = await gov.propose(
      6, // OTHER
      "Upgrade oracle contract",
      "ipfs://QmOracle",
      ethers.ZeroAddress,
      "0x",
      0,
      false
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "ProposalCreated");
    expect(event).to.not.be.undefined;
    proposalId = event.args.proposalId;
    expect(proposalId).to.equal(1n);
  });

  it("proposal is PENDING immediately after creation", async () => {
    // 0 = PENDING
    expect(await gov.proposalState(proposalId)).to.equal(0n);
  });

  // ── Voting ────────────────────────────────────────────────────────────────

  it("reverts vote cast before voting delay expires", async () => {
    await expect(
      gov.connect(voter1).castVote(proposalId, 1, "For!")
    ).to.be.revertedWith("Governance: voting not started");
  });

  it("proposal becomes ACTIVE after voting delay", async () => {
    await time.increase(VOTING_DELAY + 1n);
    // 1 = ACTIVE
    expect(await gov.proposalState(proposalId)).to.equal(1n);
  });

  it("voter1 casts FOR vote", async () => {
    const tx = await gov.connect(voter1).castVote(proposalId, 1, "Support");
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "VoteCast");
    expect(event.args.voteType).to.equal(1n); // FOR
    expect(event.args.weight).to.be.gt(0n);
  });

  it("voter1 cannot vote twice", async () => {
    await expect(
      gov.connect(voter1).castVote(proposalId, 1, "Again")
    ).to.be.revertedWith("Governance: already voted");
  });

  it("voter2 casts AGAINST vote", async () => {
    await gov.connect(voter2).castVote(proposalId, 0, "Against"); // AGAINST = 0
    const p = await gov.getProposal(proposalId);
    expect(p.againstVotes).to.be.gt(0n);
  });

  it("admin casts a large FOR vote that overcomes quorum", async () => {
    // admin has the bulk of supply (100M - 1.5M = 98.5M)
    await gov.castVote(proposalId, 1, "Admin FOR"); // FOR = 1
    expect(await gov.hasReachedQuorum(proposalId)).to.be.true;
  });

  // ── Queue & Execute ───────────────────────────────────────────────────────

  it("proposal is SUCCEEDED after voting period ends with quorum met", async () => {
    await time.increase(VOTING_PERIOD + 1n);
    // 4 = SUCCEEDED
    expect(await gov.proposalState(proposalId)).to.equal(4n);
  });

  it("queue transitions proposal to QUEUED state", async () => {
    await gov.queue(proposalId);
    // 5 = QUEUED
    expect(await gov.proposalState(proposalId)).to.equal(5n);
  });

  it("execute reverts before timelock expires (48 h)", async () => {
    await expect(
      gov.connect(executor).execute(proposalId)
    ).to.be.revertedWith("Governance: timelock active");
  });

  it("executor can execute after 48 h timelock", async () => {
    await time.increase(48n * HOUR + 1n);
    const tx = await gov.connect(executor).execute(proposalId);
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "ProposalExecuted");
    expect(event).to.not.be.undefined;
    // 6 = EXECUTED
    expect(await gov.proposalState(proposalId)).to.equal(6n);
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  it("guardian can cancel a pending proposal", async () => {
    // Create a fresh proposal
    const tx = await gov.propose(6, "Cancel me", "ipfs://QmCancel", ethers.ZeroAddress, "0x", 0, false);
    const r = await tx.wait();
    const event = r.logs.find(l => l.fragment?.name === "ProposalCreated");
    const pid = event.args.proposalId;

    await gov.connect(guardian).cancel(pid);
    // 2 = CANCELLED
    expect(await gov.proposalState(pid)).to.equal(2n);
  });

  // ── Admin parameter updates ───────────────────────────────────────────────

  it("GOV_ADMIN can update voting delay", async () => {
    const newDelay = 3n * DAY;
    await expect(gov.setVotingDelay(newDelay))
      .to.emit(gov, "GovernanceParameterUpdated")
      .withArgs("votingDelay", VOTING_DELAY, newDelay);
    expect(await gov.votingDelay()).to.equal(newDelay);
  });

  it("GOV_ADMIN can update proposal threshold", async () => {
    const newThreshold = ethers.parseEther("200000");
    await gov.setProposalThreshold(newThreshold);
    expect(await gov.proposalThreshold()).to.equal(newThreshold);
  });

  it("non-admin cannot update voting period", async () => {
    await expect(
      gov.connect(voter1).setVotingPeriod(3n * DAY)
    ).to.be.reverted;
  });

  it("GOV_ADMIN can pause and unpause", async () => {
    await gov.pause();
    // Propose should fail while paused
    await gov.setProposalThreshold(0); // lower threshold so nonHolder could propose
    await expect(
      gov.connect(voter1).propose(6, "Paused proposal", "ipfs://QmPaused", ethers.ZeroAddress, "0x", 0, false)
    ).to.be.revertedWith("Pausable: paused");
    await gov.unpause();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Treasury
// ─────────────────────────────────────────────────────────────────────────────

describe("Treasury", () => {
  let treasury, mockToken;
  let admin, treasurer, approver1, approver2, recipient, depositor, stranger;

  const SMALL_LIMIT = ethers.parseEther("1");   // 1 ETH small spend limit
  const REQ_APPROVALS = 2n;

  before(async () => {
    [admin, treasurer, approver1, approver2, recipient, depositor, stranger] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("Treasury");
    treasury = await Factory.deploy(admin.address, SMALL_LIMIT, REQ_APPROVALS);

    // Grant roles
    await treasury.grantRole(await treasury.TREASURER_ROLE(),     treasurer.address);
    await treasury.grantRole(await treasury.SPEND_APPROVER(),      approver1.address);
    await treasury.grantRole(await treasury.SPEND_APPROVER(),      approver2.address);
    await treasury.grantRole(await treasury.REVENUE_DEPOSITOR(),   depositor.address);

    // Deploy a simple ERC-20 mock (reuse NotaryToken as a stand-in)
    const TokenFactory = await ethers.getContractFactory("NotaryToken");
    mockToken = await TokenFactory.deploy(
      admin.address,
      admin.address, admin.address, admin.address,
      admin.address, admin.address, admin.address
    );

    // Fund treasury with ETH
    await admin.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("10") });
  });

  // ── Deployment ────────────────────────────────────────────────────────────

  it("stores constructor parameters", async () => {
    expect(await treasury.smallSpendLimit()).to.equal(SMALL_LIMIT);
    expect(await treasury.requiredApprovals()).to.equal(REQ_APPROVALS);
  });

  it("admin holds all treasury roles", async () => {
    const TREASURY_ADMIN  = await treasury.TREASURY_ADMIN();
    const TREASURER_ROLE  = await treasury.TREASURER_ROLE();
    const SPEND_APPROVER  = await treasury.SPEND_APPROVER();
    expect(await treasury.hasRole(TREASURY_ADMIN, admin.address)).to.be.true;
    expect(await treasury.hasRole(TREASURER_ROLE, admin.address)).to.be.true;
    expect(await treasury.hasRole(SPEND_APPROVER, admin.address)).to.be.true;
  });

  it("ethBalance reflects funded amount", async () => {
    expect(await treasury.ethBalance()).to.be.gte(ethers.parseEther("10"));
  });

  // ── Revenue Logging ───────────────────────────────────────────────────────

  it("REVENUE_DEPOSITOR can log ETH revenue", async () => {
    const value = ethers.parseEther("0.5");
    await expect(
      treasury.connect(depositor).logRevenue(depositor.address, "marketplace_fee", { value })
    ).to.emit(treasury, "RevenueReceived");
  });

  it("stranger cannot log revenue", async () => {
    await expect(
      treasury.connect(stranger).logRevenue(stranger.address, "hack", { value: 1n })
    ).to.be.reverted;
  });

  // ── Small Spend ETH ───────────────────────────────────────────────────────

  it("treasurer can perform small ETH spend", async () => {
    const amount = ethers.parseEther("0.5");
    const before = await ethers.provider.getBalance(recipient.address);
    await expect(
      treasury.connect(treasurer).smallSpendEth(recipient.address, amount, "grant")
    ).to.emit(treasury, "SmallSpend");
    const after = await ethers.provider.getBalance(recipient.address);
    expect(after - before).to.equal(amount);
  });

  it("small spend reverts when above limit", async () => {
    await expect(
      treasury.connect(treasurer).smallSpendEth(
        recipient.address,
        SMALL_LIMIT + 1n,
        "too big"
      )
    ).to.be.revertedWith("Treasury: exceeds small spend limit");
  });

  it("stranger cannot small spend", async () => {
    await expect(
      treasury.connect(stranger).smallSpendEth(recipient.address, 1n, "nope")
    ).to.be.reverted;
  });

  // ── Large Spend (timelock + multi-sig) ────────────────────────────────────

  let requestId;

  it("treasurer can request a large spend", async () => {
    const large = ethers.parseEther("2"); // > smallSpendLimit
    const tx = await treasury.connect(treasurer).requestSpend(
      recipient.address,
      ethers.ZeroAddress, // ETH
      large,
      "ecosystem grant",
      "ipfs://QmSpend"
    );
    const r = await tx.wait();
    const event = r.logs.find(l => l.fragment?.name === "SpendRequested");
    expect(event).to.not.be.undefined;
    requestId = event.args.requestId;
    expect(requestId).to.equal(1n);
  });

  it("spend cannot be executed before approvals", async () => {
    // Advance past timelock
    await time.increase(48n * HOUR + 1n);
    await expect(
      treasury.connect(admin).executeSpend(requestId)
    ).to.be.revertedWith("Treasury: insufficient approvals");
  });

  it("two approvers can approve the request", async () => {
    await expect(treasury.connect(approver1).approveSpend(requestId))
      .to.emit(treasury, "SpendApproved");
    await expect(treasury.connect(approver2).approveSpend(requestId))
      .to.emit(treasury, "SpendApproved");

    const [, , , , , , , approvalCount] = await treasury.getSpendRequest(requestId);
    expect(approvalCount).to.equal(2n);
  });

  it("same approver cannot approve twice", async () => {
    await expect(
      treasury.connect(approver1).approveSpend(requestId)
    ).to.be.revertedWith("Treasury: already approved");
  });

  it("treasury admin can execute after approval + timelock", async () => {
    const before = await ethers.provider.getBalance(recipient.address);
    await expect(treasury.connect(admin).executeSpend(requestId))
      .to.emit(treasury, "SpendExecuted");
    const after = await ethers.provider.getBalance(recipient.address);
    expect(after - before).to.equal(ethers.parseEther("2"));
  });

  it("cannot execute same request twice", async () => {
    await expect(
      treasury.connect(admin).executeSpend(requestId)
    ).to.be.revertedWith("Treasury: already executed");
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  it("treasury admin can cancel a pending request", async () => {
    const tx = await treasury.connect(treasurer).requestSpend(
      recipient.address,
      ethers.ZeroAddress,
      ethers.parseEther("3"),
      "cancel test",
      "ipfs://QmCancel"
    );
    const r  = await tx.wait();
    const ev = r.logs.find(l => l.fragment?.name === "SpendRequested");
    const rid = ev.args.requestId;

    await expect(treasury.connect(admin).cancelSpend(rid))
      .to.emit(treasury, "SpendCancelled");

    const [, , , , , , cancelled] = await treasury.getSpendRequest(rid);
    expect(cancelled).to.be.true;
  });

  // ── Admin ─────────────────────────────────────────────────────────────────

  it("treasury admin can update smallSpendLimit", async () => {
    const newLimit = ethers.parseEther("2");
    await expect(treasury.setSmallSpendLimit(newLimit))
      .to.emit(treasury, "ParameterUpdated");
    expect(await treasury.smallSpendLimit()).to.equal(newLimit);
  });

  it("setRequiredApprovals reverts for < 2", async () => {
    await expect(
      treasury.setRequiredApprovals(1)
    ).to.be.revertedWith("Treasury: min 2");
  });

  it("treasury admin can pause and unpause", async () => {
    await treasury.pause();
    await expect(
      treasury.connect(treasurer).smallSpendEth(recipient.address, 1n, "paused")
    ).to.be.revertedWith("Pausable: paused");
    await treasury.unpause();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JurisdictionManager
// ─────────────────────────────────────────────────────────────────────────────

describe("JurisdictionManager", () => {
  let jm;
  let admin, governance, proposer, stranger;

  const RULE_JSON   = ethers.toUtf8Bytes(JSON.stringify({ ruleKey: "notary_witness", version: 1 }));
  const CONTENT_HASH = ethers.keccak256(RULE_JSON);

  before(async () => {
    [admin, governance, proposer, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("JurisdictionManager");
    jm = await Factory.deploy(admin.address, governance.address);

    // Grant proposer role to an external notary
    await jm.grantProposer(proposer.address);
  });

  // ── Deployment ────────────────────────────────────────────────────────────

  it("seeds five US jurisdictions on deployment", async () => {
    const codes = await jm.getSupportedJurisdictions();
    expect(codes).to.deep.equal(["US", "US-CA", "US-NY", "US-TX", "US-FL"]);
  });

  it("all seeded jurisdictions are marked supported", async () => {
    for (const code of ["US", "US-CA", "US-NY", "US-TX", "US-FL"]) {
      expect(await jm.isJurisdictionSupported(code)).to.be.true;
    }
  });

  it("governance holds RULE_APPROVER", async () => {
    expect(await jm.hasRole(await jm.RULE_APPROVER(), governance.address)).to.be.true;
  });

  // ── Jurisdiction Management ───────────────────────────────────────────────

  it("admin can add a new jurisdiction", async () => {
    await expect(jm.addJurisdiction("EU", "European Union"))
      .to.emit(jm, "JurisdictionAdded")
      .withArgs("EU", "European Union");
    expect(await jm.isJurisdictionSupported("EU")).to.be.true;
  });

  it("adding an existing jurisdiction reverts", async () => {
    await expect(jm.addJurisdiction("US", "United States"))
      .to.be.revertedWith("JurisdictionManager: already exists");
  });

  it("admin can remove a jurisdiction", async () => {
    await expect(jm.removeJurisdiction("EU"))
      .to.emit(jm, "JurisdictionRemoved")
      .withArgs("EU");
    expect(await jm.isJurisdictionSupported("EU")).to.be.false;
  });

  it("stranger cannot add or remove jurisdictions", async () => {
    await expect(jm.connect(stranger).addJurisdiction("XX", "Test")).to.be.reverted;
    await expect(jm.connect(stranger).removeJurisdiction("US")).to.be.reverted;
  });

  // ── Rule Lifecycle ────────────────────────────────────────────────────────

  let ruleId;

  it("proposer can propose a new rule for US", async () => {
    const tx = await jm.connect(proposer).proposeRule(
      "US",
      "notary_witness",
      "ipfs://QmRule1",
      CONTENT_HASH,
      0, // LegalMode.COMPLIANT
      0, // AuthorityType.HUMAN_COMMISSIONED
      50,
      true,
      7
    );
    const r  = await tx.wait();
    const ev = r.logs.find(l => l.fragment?.name === "RuleProposed");
    expect(ev).to.not.be.undefined;
    ruleId = ev.args.ruleId;
    expect(ruleId).to.equal(1n);
  });

  it("stranger cannot propose a rule", async () => {
    await expect(
      jm.connect(stranger).proposeRule(
        "US", "key", "ipfs://QmBad", CONTENT_HASH, 0, 0, 50, false, 1
      )
    ).to.be.reverted;
  });

  it("rule is in PROPOSED state after creation", async () => {
    const rule = await jm.getRule(ruleId);
    expect(rule.status).to.equal(0n); // PROPOSED
    expect(rule.version).to.equal(1n);
    expect(rule.ruleKey).to.equal("notary_witness");
    expect(rule.jurisdictionCode).to.equal("US");
  });

  it("stranger cannot activate a rule", async () => {
    await expect(jm.connect(stranger).activateRule(ruleId)).to.be.reverted;
  });

  it("governance (RULE_APPROVER) can activate the rule", async () => {
    await expect(jm.connect(governance).activateRule(ruleId))
      .to.emit(jm, "RuleActivated")
      .withArgs(ruleId, "US", "notary_witness");

    const rule = await jm.getRule(ruleId);
    expect(rule.status).to.equal(1n); // ACTIVE
    expect(rule.activatedAt).to.be.gt(0n);
  });

  it("active rule is retrievable via getActiveRule", async () => {
    const rule = await jm.getActiveRule("US", "notary_witness");
    expect(rule.ruleId).to.equal(ruleId);
    expect(rule.status).to.equal(1n); // ACTIVE
  });

  it("getActiveRule reverts for unknown key", async () => {
    await expect(jm.getActiveRule("US", "nonexistent_key"))
      .to.be.revertedWith("JurisdictionManager: no active rule");
  });

  it("getJurisdictionRules returns all proposed rule IDs for a code", async () => {
    const ids = await jm.getJurisdictionRules("US");
    expect(ids.map(id => id.toString())).to.include(ruleId.toString());
  });

  // ── Rule Versioning ───────────────────────────────────────────────────────

  let ruleId2;

  it("proposing a second rule for the same key increments version", async () => {
    const newJson = ethers.toUtf8Bytes(JSON.stringify({ ruleKey: "notary_witness", version: 2 }));
    const newHash = ethers.keccak256(newJson);

    const tx = await jm.connect(proposer).proposeRule(
      "US", "notary_witness", "ipfs://QmRule2", newHash, 0, 0, 60, true, 7
    );
    const r  = await tx.wait();
    const ev = r.logs.find(l => l.fragment?.name === "RuleProposed");
    ruleId2  = ev.args.ruleId;

    const rule = await jm.getRule(ruleId2);
    expect(rule.version).to.equal(2n);
  });

  it("activating v2 deprecates v1", async () => {
    await jm.connect(governance).activateRule(ruleId2);

    const rule1 = await jm.getRule(ruleId);
    expect(rule1.status).to.equal(2n); // DEPRECATED

    const rule2 = await jm.getRule(ruleId2);
    expect(rule2.status).to.equal(1n); // ACTIVE
  });

  // ── Rejection ─────────────────────────────────────────────────────────────

  it("governance can reject a proposed rule", async () => {
    const newHash = ethers.keccak256(ethers.toUtf8Bytes("rejected rule"));
    const tx = await jm.connect(proposer).proposeRule(
      "US-CA", "ca_signing", "ipfs://QmReject", newHash, 0, 0, 30, false, 5
    );
    const r   = await tx.wait();
    const ev  = r.logs.find(l => l.fragment?.name === "RuleProposed");
    const rid = ev.args.ruleId;

    await expect(jm.connect(governance).rejectRule(rid, "Failed DAO vote"))
      .to.emit(jm, "RuleRejected")
      .withArgs(rid, "Failed DAO vote");

    const rule = await jm.getRule(rid);
    expect(rule.status).to.equal(3n); // REJECTED
  });

  // ── Manual Deprecation ────────────────────────────────────────────────────

  it("jurisdiction admin can manually deprecate an active rule", async () => {
    await expect(jm.deprecateRule(ruleId2))
      .to.emit(jm, "RuleDeprecated")
      .withArgs(ruleId2, 0n);

    const rule = await jm.getRule(ruleId2);
    expect(rule.status).to.equal(2n); // DEPRECATED
  });

  it("deprecating a non-active rule reverts", async () => {
    await expect(jm.deprecateRule(ruleId))
      .to.be.revertedWith("JurisdictionManager: not active");
  });

  // ── Content Verification ──────────────────────────────────────────────────

  it("verifyContent succeeds for matching JSON", async () => {
    await expect(jm.verifyContent(ruleId, RULE_JSON))
      .to.emit(jm, "ContentHashVerified")
      .withArgs(ruleId, CONTENT_HASH);
  });

  it("verifyContent reverts for tampered JSON", async () => {
    const tampered = ethers.toUtf8Bytes("tampered");
    await expect(jm.verifyContent(ruleId, tampered))
      .to.be.revertedWith("JurisdictionManager: content mismatch");
  });

  // ── Proposer Role Management ──────────────────────────────────────────────

  it("admin can revoke proposer role", async () => {
    await jm.revokeProposer(proposer.address);
    expect(await jm.hasRole(await jm.RULE_PROPOSER(), proposer.address)).to.be.false;
  });

  it("revoked proposer cannot propose", async () => {
    await expect(
      jm.connect(proposer).proposeRule(
        "US-NY", "ny_seal", "ipfs://QmNY",
        ethers.keccak256(ethers.toUtf8Bytes("ny")), 0, 0, 20, false, 3
      )
    ).to.be.reverted;
  });

  // ── Pause ─────────────────────────────────────────────────────────────────

  it("admin can pause and unpause", async () => {
    await jm.pause();
    expect(await jm.paused()).to.be.true;

    await jm.unpause();
    expect(await jm.paused()).to.be.false;
  });
});
