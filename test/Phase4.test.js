/**
 * ============================================================================
 * File:      test/Phase4.test.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Phase 4 contract tests: TransferRestrictions, GDPRManager
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─────────────────────────────────────────────────────────────────────────────
// TransferRestrictions
// ─────────────────────────────────────────────────────────────────────────────

describe("TransferRestrictions", () => {
  let restrictions, admin, kycOracle, transferAgent, tokenAddr;
  let usInvestor, offshoreInvestor, unknownInvestor;

  before(async () => {
    [admin, kycOracle, transferAgent, usInvestor, offshoreInvestor, unknownInvestor]
      = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("TransferRestrictions");
    restrictions = await Factory.deploy(admin.address);

    await restrictions.grantRole(await restrictions.KYC_ORACLE(), kycOracle.address);
    await restrictions.grantRole(await restrictions.TRANSFER_AGENT(), transferAgent.address);

    // Deploy a mock token address
    const MockERC20 = await ethers.getContractFactory("DocumentSecurityToken");
    const tok = await MockERC20.deploy(
      "Restricted Token", "RTOK",
      ethers.keccak256(ethers.toUtf8Bytes("restricted-doc")),
      ethers.parseEther("1000000"),
      "US",
      ethers.parseEther("1"),
      admin.address
    );
    tokenAddr = await tok.getAddress();

    // Register offering (Reg D, max 2000 investors)
    await restrictions.registerOffering(tokenAddr, 0, 2000); // REG_D
  });

  it("registers a Reg D offering", async () => {
    const offering = await restrictions.getOffering(tokenAddr);
    expect(offering.active).to.be.true;
    expect(offering.offeringType).to.equal(0n); // REG_D
    expect(offering.maxInvestors).to.equal(2000n);
  });

  it("KYC oracle can update investor profile", async () => {
    await restrictions.connect(kycOracle).updateInvestorProfile(
      usInvestor.address,
      true,   // kycApproved
      true,   // accredited
      false,  // qualifiedPurchaser
      0       // InvestorRegion.US
    );

    const profile = await restrictions.getInvestorProfile(usInvestor.address);
    expect(profile.kycApproved).to.be.true;
    expect(profile.accredited).to.be.true;
    expect(profile.region).to.equal(0n); // US
  });

  it("allows transfer to KYC'd accredited US investor after lockup", async () => {
    // Record holding for seller
    await restrictions.connect(kycOracle).updateInvestorProfile(
      admin.address, true, true, false, 0
    );
    await restrictions.connect(transferAgent).recordHolding(tokenAddr, admin.address);

    // Fast forward past 1-year Reg D lockup
    await time.increase(366 * 24 * 60 * 60);

    const [allowed] = await restrictions.isTransferAllowed.staticCall(
      tokenAddr, admin.address, usInvestor.address, ethers.parseEther("100")
    );
    expect(allowed).to.be.true;
  });

  it("blocks transfer to non-KYC'd recipient", async () => {
    const [allowed, reason] = await restrictions.isTransferAllowed.staticCall(
      tokenAddr, admin.address, unknownInvestor.address, ethers.parseEther("100")
    );
    expect(allowed).to.be.false;
    expect(reason).to.equal("recipient_kyc_invalid");
  });

  it("disqualifies bad actor", async () => {
    await restrictions.connect(admin).disqualifyInvestor(unknownInvestor.address, "SEC disqualification");
    const profile = await restrictions.getInvestorProfile(unknownInvestor.address);
    expect(profile.disqualified).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GDPRManager
// ─────────────────────────────────────────────────────────────────────────────

describe("GDPRManager", () => {
  let gdpr, admin, dpo, processor, dataSubject;
  const docHash = ethers.keccak256(ethers.toUtf8Bytes("gdpr-test-document"));

  before(async () => {
    [admin, dpo, processor, dataSubject] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GDPRManager");
    gdpr = await Factory.deploy(admin.address, dpo.address);
    await gdpr.grantRole(await gdpr.DATA_PROCESSOR(), processor.address);
  });

  it("data subject can grant consent", async () => {
    const tx = await gdpr.connect(dataSubject).grantConsent(
      docHash,
      0,           // LegalBasis.CONSENT
      "ipfs://purpose-description",
      365n * 24n * 60n * 60n  // 1-year TTL
    );
    await tx.wait();

    const consent = await gdpr.getConsent(1);
    expect(consent.dataSubject).to.equal(dataSubject.address);
    expect(consent.documentHash).to.equal(docHash);
  });

  it("data subject can withdraw consent", async () => {
    await gdpr.connect(dataSubject).withdrawConsent(1);
    expect(await gdpr.isConsentActive(1)).to.be.false;
  });

  it("data subject can request erasure", async () => {
    await gdpr.connect(dataSubject).requestErasure(docHash, "Article 17 request");
    const request = await gdpr.getErasureRequest(1);
    expect(request.dataSubject).to.equal(dataSubject.address);
    expect(request.status).to.equal(0n); // PENDING
  });

  it("processor can set retention policy", async () => {
    const futureExpiry = BigInt(Math.floor(Date.now() / 1000)) + 7n * 365n * 24n * 60n * 60n;
    await gdpr.connect(processor).setRetentionPolicy(docHash, futureExpiry, 0);
    const policy = await gdpr.getRetentionPolicy(docHash);
    expect(policy.retainUntil).to.equal(futureExpiry);
  });

  it("erasure is blocked during active retention period", async () => {
    const [canErase, reason] = await gdpr.canErase(docHash);
    expect(canErase).to.be.false;
    expect(reason).to.equal("retention_period_active");
  });

  it("processor marks erasure as rejected due to retention", async () => {
    await gdpr.connect(processor).markErased(1, 3, "retention_period_active");
    const request = await gdpr.getErasureRequest(1);
    expect(request.status).to.equal(3n); // REJECTED
  });

  it("DPO can apply and release legal hold", async () => {
    await gdpr.connect(dpo).applyLegalHold(docHash, "Litigation hold");
    const policy = await gdpr.getRetentionPolicy(docHash);
    expect(policy.legalHoldActive).to.be.true;

    await gdpr.connect(dpo).releaseLegalHold(docHash);
    const policyAfter = await gdpr.getRetentionPolicy(docHash);
    expect(policyAfter.legalHoldActive).to.be.false;
  });
});
