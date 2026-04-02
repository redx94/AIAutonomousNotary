/**
 * ============================================================================
 * File:      test/Phase3.test.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Phase 3 contract tests: NLPEngine, FraudDetection, ZKProof
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const DOC_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-document-nlp"));

// ─────────────────────────────────────────────────────────────────────────────
// NLPEngine
// ─────────────────────────────────────────────────────────────────────────────

describe("NLPEngine", () => {
  let nlp, admin, oracle, requester;

  before(async () => {
    [admin, oracle, requester] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("NLPEngine");
    nlp = await Factory.deploy(admin.address, 1n);

    await nlp.addOracle(oracle.address);
    await nlp.addRequester(requester.address);
  });

  it("requester can submit an analysis request", async () => {
    const tx = await nlp.connect(requester).requestAnalysis(DOC_HASH, "US", 0);
    await tx.wait();

    const req = await nlp.getRequest(1);
    expect(req.status).to.equal(0n); // PENDING
    expect(req.documentHash).to.equal(DOC_HASH);
    expect(req.jurisdiction).to.equal("US");
  });

  it("oracle can submit a result", async () => {
    const clauses = [
      {
        clauseType: "indemnity",
        excerpt: "party shall indemnify...",
        excerptHash: ethers.keccak256(ethers.toUtf8Bytes("party shall indemnify...")),
        risk: 1, // MEDIUM
        flagged: false,
        flagReason: "",
      }
    ];

    const resultHash = ethers.keccak256(ethers.toUtf8Bytes('{"full":"result"}'));
    await nlp.connect(oracle).submitResult(
      1,              // requestId
      1,              // ContractType.AGREEMENT
      2500n,          // riskScore (25%)
      true,           // jurisdictionCompliant
      ["grantor", "grantee"],
      clauses,
      resultHash
    );

    const result = await nlp.getResult(1);
    expect(result.riskScore).to.equal(2500n);
    expect(result.jurisdictionCompliant).to.be.true;
    expect(result.totalClauses).to.equal(1n);
    expect(result.flaggedClauses).to.equal(0n);
  });

  it("returns clauses for a request", async () => {
    const clauses = await nlp.getClauses(1);
    expect(clauses.length).to.equal(1);
    expect(clauses[0].clauseType).to.equal("indemnity");
  });

  it("non-oracle cannot submit result", async () => {
    await expect(
      nlp.connect(requester).submitResult(1, 0, 1000n, true, [], [], ethers.ZeroHash)
    ).to.be.reverted;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FraudDetection
// ─────────────────────────────────────────────────────────────────────────────

describe("FraudDetection", () => {
  let fraud, admin, oracleNode, analyst, subject;
  const docHash = ethers.keccak256(ethers.toUtf8Bytes("fraud-test-doc"));

  before(async () => {
    [admin, oracleNode, analyst, subject] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FraudDetection");
    fraud = await Factory.deploy(admin.address);
    await fraud.addOracle(oracleNode.address);
    await fraud.addAnalyst(analyst.address);
  });

  it("oracle can report a fraud signal", async () => {
    await fraud.connect(oracleNode).reportSignal(
      docHash,
      subject.address,
      0,        // SignalType.DOCUMENT_TAMPER
      4000n,    // score: 40%
      "ipfs://evidence"
    );

    const profile = await fraud.getDocumentProfile(docHash);
    expect(profile.signalCount).to.equal(1n);
    expect(profile.alertActive).to.be.true;  // 40% > 30% threshold
    expect(profile.compositeScore).to.equal(4000n);
  });

  it("links similar documents", async () => {
    const docHash2 = ethers.keccak256(ethers.toUtf8Bytes("fraud-test-doc-2"));
    await fraud.connect(oracleNode).linkSimilarDocuments(docHash, docHash2);
    const similar = await fraud.getSimilarDocuments(docHash);
    expect(similar).to.include(docHash2);
  });

  it("analyst can verify a signal", async () => {
    await fraud.connect(analyst).verifySignal(1);
    const signal = await fraud.signals(1);
    expect(signal.verified).to.be.true;
  });

  it("high-score document gets blacklisted", async () => {
    // Report more signals to push above 70% blacklist threshold
    await fraud.connect(oracleNode).reportSignal(
      docHash, subject.address, 4n, 9000n, "ipfs://sanction"
    );
    const profile = await fraud.getDocumentProfile(docHash);
    expect(profile.blacklisted).to.be.true;
  });

  it("blacklisted check works", async () => {
    expect(await fraud.isDocumentBlacklisted(docHash)).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ZKProof
// ─────────────────────────────────────────────────────────────────────────────

describe("ZKProof", () => {
  let zkProof, admin, prover;
  const vkHash = ethers.keccak256(ethers.toUtf8Bytes("test-verification-key"));
  const contextHash = ethers.keccak256(ethers.toUtf8Bytes("test-document-ctx"));
  const nullifier   = ethers.keccak256(ethers.toUtf8Bytes("unique-nullifier-1"));

  before(async () => {
    [admin, prover] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ZKProof");
    zkProof = await Factory.deploy(admin.address, 30n * 24n * 60n * 60n);
  });

  it("admin can register a circuit", async () => {
    await zkProof.registerCircuit(vkHash, 0, "Document ownership proof");
    const vk = await zkProof.verificationKeys(vkHash);
    expect(vk.active).to.be.true;
    expect(vk.circuitType).to.equal(0n); // DOCUMENT_OWNERSHIP
  });

  it("prover can submit a valid proof (stub verifier)", async () => {
    // Stub verifier accepts any proof with non-zero B point
    const proofA = [1n, 2n];
    const proofB = [3n, 4n, 5n, 6n]; // non-zero → passes stub
    const proofC = [7n, 8n];
    const publicInputs = [1n];

    const tx = await zkProof.connect(prover).verifyProof(
      vkHash,
      publicInputs,
      proofA,
      proofB,
      proofC,
      nullifier,
      contextHash,
      0n // default TTL
    );
    await tx.wait();

    const records = await zkProof.getProverProofs(prover.address);
    expect(records.length).to.equal(1);
  });

  it("cannot reuse nullifier", async () => {
    const proofA = [1n, 2n], proofB = [3n, 4n, 5n, 6n], proofC = [7n, 8n];
    await expect(
      zkProof.connect(prover).verifyProof(
        vkHash, [1n], proofA, proofB, proofC,
        nullifier, // same nullifier
        contextHash, 0n
      )
    ).to.be.revertedWith("ZKProof: proof already used");
  });

  it("contextHasValidProof returns true", async () => {
    const hasProof = await zkProof.contextHasValidProof(contextHash, 0); // DOCUMENT_OWNERSHIP
    expect(hasProof).to.be.true;
  });

  it("admin can revoke a proof", async () => {
    const proofIds = await zkProof.getProverProofs(prover.address);
    await zkProof.connect(admin).revokeProof(proofIds[0]);
    expect(await zkProof.isProofValid(proofIds[0])).to.be.false;
  });
});
