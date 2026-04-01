const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

/**
 * @title AI Autonomous Notary Protocol — Phase 1 Test Suite
 * @notice Comprehensive tests covering all Phase 1 contracts:
 *         NotaryNFT, DocumentRegistry, DocumentSecurityToken,
 *         NotaryAccessControl, EmergencyProtocol, AIEngine,
 *         OracleManager, ValidationOracle
 */

describe("AI Autonomous Notary Protocol — Phase 1", function () {
  // ─── Signers ───────────────────────────────────────────────────────────────
  let admin, notary, validator, oracle1, oracle2, oracle3;
  let user1, user2, treasury, guardian;

  // ─── Contracts ────────────────────────────────────────────────────────────
  let notaryNFT, documentRegistry, documentSecurityToken;
  let accessControl, emergencyProtocol, aiEngine, oracleManager, validationOracle;

  // ─── Constants ────────────────────────────────────────────────────────────
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample document content"));
  const SAMPLE_METADATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample metadata"));
  const SAMPLE_IPFS_CID = "QmSampleCIDForTestingPurposesOnly123456789";
  const SAMPLE_JURISDICTION = "US";
  const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

  const DocumentType = { DEED: 0, CONTRACT: 1, WILL: 2, POWER_OF_ATTORNEY: 3, AFFIDAVIT: 4, CERTIFICATE: 5, PATENT: 6, OTHER: 7 };
  const SealStatus   = { ACTIVE: 0, SUSPENDED: 1, REVOKED: 2, EXPIRED: 3 };

  // ─────────────────────────────────────────────────────────────────────────
  // Setup
  // ─────────────────────────────────────────────────────────────────────────

  beforeEach(async function () {
    [admin, notary, validator, oracle1, oracle2, oracle3, user1, user2, treasury, guardian] =
      await ethers.getSigners();

    // Deploy NotaryNFT
    const NotaryNFT = await ethers.getContractFactory("NotaryNFT");
    notaryNFT = await NotaryNFT.deploy(admin.address);
    await notaryNFT.waitForDeployment();

    // Grant roles on NotaryNFT
    const MINTER_ROLE = await notaryNFT.MINTER_ROLE();
    await notaryNFT.grantRole(MINTER_ROLE, notary.address);

    // Deploy DocumentRegistry
    const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
    documentRegistry = await DocumentRegistry.deploy(admin.address);
    await documentRegistry.waitForDeployment();

    // Grant validator role
    const VALIDATOR_ROLE = await documentRegistry.VALIDATOR_ROLE();
    const NOTARY_ROLE    = await documentRegistry.NOTARY_ROLE();
    await documentRegistry.grantRole(VALIDATOR_ROLE, validator.address);
    await documentRegistry.grantRole(NOTARY_ROLE,    notary.address);

    // Deploy EmergencyProtocol
    const EmergencyProtocol = await ethers.getContractFactory("EmergencyProtocol");
    emergencyProtocol = await EmergencyProtocol.deploy(admin.address, [guardian.address]);
    await emergencyProtocol.waitForDeployment();

    // Deploy AIEngine
    const AIEngine = await ethers.getContractFactory("AIEngine");
    aiEngine = await AIEngine.deploy(admin.address, [oracle1.address, oracle2.address, oracle3.address]);
    await aiEngine.waitForDeployment();

    // Grant requestor role
    const REQUESTOR_ROLE = await aiEngine.REQUESTOR_ROLE();
    await aiEngine.grantRole(REQUESTOR_ROLE, notary.address);

    // Deploy OracleManager
    const OracleManager = await ethers.getContractFactory("OracleManager");
    oracleManager = await OracleManager.deploy(admin.address);
    await oracleManager.waitForDeployment();

    // Deploy ValidationOracle
    const ValidationOracle = await ethers.getContractFactory("ValidationOracle");
    validationOracle = await ValidationOracle.deploy(
      admin.address,
      [oracle1.address, oracle2.address, oracle3.address]
    );
    await validationOracle.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. NotaryNFT
  // ─────────────────────────────────────────────────────────────────────────

  describe("NotaryNFT", function () {
    describe("Deployment", function () {
      it("should have correct name and symbol", async function () {
        expect(await notaryNFT.name()).to.equal("NotaryNFT");
        expect(await notaryNFT.symbol()).to.equal("NOTARY");
      });

      it("should grant admin roles on deployment", async function () {
        const ADMIN = await notaryNFT.DEFAULT_ADMIN_ROLE();
        expect(await notaryNFT.hasRole(ADMIN, admin.address)).to.be.true;
      });
    });

    describe("Minting", function () {
      let mintTx, tokenId;
      const docDate = Math.floor(Date.now() / 1000) - 86400; // 1 day ago

      beforeEach(async function () {
        const tx = await notaryNFT.connect(notary).mintNotarySeal(
          user1.address,
          SAMPLE_HASH,
          SAMPLE_METADATA_HASH,
          SAMPLE_IPFS_CID,
          SAMPLE_JURISDICTION,
          DocumentType.CONTRACT,
          docDate,
          0,  // no expiry
          1,  // registry ID
          8500, // 85% confidence
          0,  // no extra signatories
          `ipfs://${SAMPLE_IPFS_CID}`
        );
        mintTx = await tx.wait();
        tokenId = 1n;
      });

      it("should mint a token with correct ID", async function () {
        expect(await notaryNFT.ownerOf(tokenId)).to.equal(user1.address);
      });

      it("should store correct seal metadata", async function () {
        const seal = await notaryNFT.getSeal(tokenId);
        expect(seal.documentHash).to.equal(SAMPLE_HASH);
        expect(seal.notary).to.equal(notary.address);
        expect(seal.jurisdiction).to.equal(SAMPLE_JURISDICTION);
        expect(seal.aiValidated).to.be.true; // 85% > 70% threshold
        expect(seal.confidenceScore).to.equal(8500n);
      });

      it("should prevent duplicate document registration", async function () {
        await expect(
          notaryNFT.connect(notary).mintNotarySeal(
            user2.address, SAMPLE_HASH, SAMPLE_METADATA_HASH,
            SAMPLE_IPFS_CID, SAMPLE_JURISDICTION, DocumentType.CONTRACT,
            docDate, 0, 2, 8000, 0, `ipfs://${SAMPLE_IPFS_CID}`
          )
        ).to.be.revertedWith("NotaryNFT: document already notarized");
      });

      it("should reject minting without MINTER_ROLE", async function () {
        const hash2 = ethers.keccak256(ethers.toUtf8Bytes("another doc"));
        await expect(
          notaryNFT.connect(user1).mintNotarySeal(
            user1.address, hash2, SAMPLE_METADATA_HASH,
            SAMPLE_IPFS_CID, SAMPLE_JURISDICTION, DocumentType.DEED,
            docDate, 0, 0, 9000, 0, `ipfs://${SAMPLE_IPFS_CID}`
          )
        ).to.be.reverted;
      });

      it("should emit NotarySealMinted event", async function () {
        const hash2 = ethers.keccak256(ethers.toUtf8Bytes("event test doc"));
        await expect(
          notaryNFT.connect(notary).mintNotarySeal(
            user1.address, hash2, SAMPLE_METADATA_HASH,
            SAMPLE_IPFS_CID, SAMPLE_JURISDICTION, DocumentType.AFFIDAVIT,
            docDate, 0, 0, 9000, 0, `ipfs://${SAMPLE_IPFS_CID}`
          )
        ).to.emit(notaryNFT, "NotarySealMinted");
      });
    });

    describe("Compliance Controls", function () {
      let tokenId = 1n;
      const docDate = Math.floor(Date.now() / 1000) - 86400;

      beforeEach(async function () {
        await notaryNFT.connect(notary).mintNotarySeal(
          user1.address, SAMPLE_HASH, SAMPLE_METADATA_HASH,
          SAMPLE_IPFS_CID, SAMPLE_JURISDICTION, DocumentType.CONTRACT,
          docDate, 0, 1, 8500, 0, `ipfs://${SAMPLE_IPFS_CID}`
        );
      });

      it("should suspend a seal", async function () {
        await notaryNFT.connect(admin).suspendSeal(tokenId);
        const seal = await notaryNFT.getSeal(tokenId);
        expect(seal.status).to.equal(SealStatus.SUSPENDED);
      });

      it("should revoke a seal", async function () {
        await notaryNFT.connect(admin).revokeSeal(tokenId);
        const seal = await notaryNFT.getSeal(tokenId);
        expect(seal.status).to.equal(SealStatus.REVOKED);
      });

      it("should block transfers on revoked seals", async function () {
        await notaryNFT.connect(admin).revokeSeal(tokenId);
        await expect(
          notaryNFT.connect(user1).transferFrom(user1.address, user2.address, tokenId)
        ).to.be.revertedWith("NotaryNFT: seal not active");
      });

      it("should lock and unlock transfers", async function () {
        await notaryNFT.connect(admin).setTransferLock(tokenId, true);
        await expect(
          notaryNFT.connect(user1).transferFrom(user1.address, user2.address, tokenId)
        ).to.be.revertedWith("NotaryNFT: transfer locked");

        await notaryNFT.connect(admin).setTransferLock(tokenId, false);
        await notaryNFT.connect(user1).transferFrom(user1.address, user2.address, tokenId);
        expect(await notaryNFT.ownerOf(tokenId)).to.equal(user2.address);
      });

      it("should validate seal correctly", async function () {
        expect(await notaryNFT.isSealValid(tokenId)).to.be.true;
        await notaryNFT.connect(admin).revokeSeal(tokenId);
        expect(await notaryNFT.isSealValid(tokenId)).to.be.false;
      });
    });

    describe("Pause Mechanism", function () {
      it("should pause and unpause minting", async function () {
        await notaryNFT.connect(admin).pause();
        const hash2 = ethers.keccak256(ethers.toUtf8Bytes("paused doc"));
        await expect(
          notaryNFT.connect(notary).mintNotarySeal(
            user1.address, hash2, SAMPLE_METADATA_HASH,
            SAMPLE_IPFS_CID, SAMPLE_JURISDICTION, DocumentType.CONTRACT,
            Math.floor(Date.now() / 1000) - 86400, 0, 0, 9000, 0, "ipfs://test"
          )
        ).to.be.revertedWith("Pausable: paused");

        await notaryNFT.connect(admin).unpause();
        // Should succeed now (tested in minting tests)
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DocumentRegistry
  // ─────────────────────────────────────────────────────────────────────────

  describe("DocumentRegistry", function () {
    describe("Document Registration", function () {
      it("should register a document", async function () {
        const tx = await documentRegistry.connect(user1).registerDocument(
          SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID,
          0, SAMPLE_JURISDICTION, 0
        );
        await tx.wait();

        const doc = await documentRegistry.getDocument(1n);
        expect(doc.documentHash).to.equal(SAMPLE_HASH);
        expect(doc.owner).to.equal(user1.address);
        expect(doc.jurisdiction).to.equal(SAMPLE_JURISDICTION);
      });

      it("should prevent duplicate registration", async function () {
        await documentRegistry.connect(user1).registerDocument(
          SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID,
          0, SAMPLE_JURISDICTION, 0
        );
        await expect(
          documentRegistry.connect(user2).registerDocument(
            SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID,
            0, "EU", 0
          )
        ).to.be.revertedWith("DocumentRegistry: document already registered");
      });

      it("should reject null document hash", async function () {
        await expect(
          documentRegistry.connect(user1).registerDocument(
            ZERO_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID, 0, SAMPLE_JURISDICTION, 0
          )
        ).to.be.revertedWith("DocumentRegistry: null document hash");
      });

      it("should track owner's documents", async function () {
        await documentRegistry.connect(user1).registerDocument(
          SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID, 0, SAMPLE_JURISDICTION, 0
        );
        const docs = await documentRegistry.getOwnerDocuments(user1.address);
        expect(docs.length).to.equal(1);
        expect(docs[0]).to.equal(1n);
      });

      it("should emit DocumentRegistered event", async function () {
        await expect(
          documentRegistry.connect(user1).registerDocument(
            SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID, 0, SAMPLE_JURISDICTION, 0
          )
        ).to.emit(documentRegistry, "DocumentRegistered");
      });
    });

    describe("Document Workflow", function () {
      beforeEach(async function () {
        await documentRegistry.connect(user1).registerDocument(
          SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID, 0, SAMPLE_JURISDICTION, 0
        );
      });

      it("should validate a document", async function () {
        await documentRegistry.connect(validator).validateDocument(1n);
        const doc = await documentRegistry.getDocument(1n);
        expect(doc.status).to.equal(1n); // VALIDATED
      });

      it("should notarize a validated document", async function () {
        await documentRegistry.connect(validator).validateDocument(1n);
        await documentRegistry.connect(notary).notarizeDocument(1n, 42n);
        const doc = await documentRegistry.getDocument(1n);
        expect(doc.status).to.equal(2n); // NOTARIZED
        expect(doc.tokenId).to.equal(42n);
      });

      it("should fail to notarize without prior validation", async function () {
        await expect(
          documentRegistry.connect(notary).notarizeDocument(1n, 1n)
        ).to.be.revertedWith("DocumentRegistry: must be VALIDATED");
      });

      it("should transfer document ownership", async function () {
        await documentRegistry.connect(validator).validateDocument(1n);
        await documentRegistry.connect(notary).notarizeDocument(1n, 1n);
        await documentRegistry.connect(user1).transferDocumentOwnership(1n, user2.address);
        const doc = await documentRegistry.getDocument(1n);
        expect(doc.owner).to.equal(user2.address);
      });

      it("should maintain provenance chain", async function () {
        await documentRegistry.connect(validator).validateDocument(1n);
        await documentRegistry.connect(notary).notarizeDocument(1n, 1n);
        await documentRegistry.connect(user1).transferDocumentOwnership(1n, user2.address);

        const chain = await documentRegistry.getProvenanceChain(1n);
        expect(chain.length).to.equal(2);
        expect(chain[0]).to.equal(user1.address);
        expect(chain[1]).to.equal(user2.address);
      });

      it("should revoke a document", async function () {
        const REGISTRY_ADMIN = await documentRegistry.REGISTRY_ADMIN();
        await documentRegistry.connect(admin).revokeDocument(1n, "Court order #12345");
        const doc = await documentRegistry.getDocument(1n);
        expect(doc.status).to.equal(4n); // REVOKED
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. EmergencyProtocol
  // ─────────────────────────────────────────────────────────────────────────

  describe("EmergencyProtocol", function () {
    it("should start at NONE level", async function () {
      expect(await emergencyProtocol.currentLevel()).to.equal(0n);
    });

    it("should trigger Level 1 emergency", async function () {
      await emergencyProtocol.connect(guardian).triggerLevel1(
        0, "Security breach detected", SAMPLE_HASH
      );
      expect(await emergencyProtocol.currentLevel()).to.equal(1n);
    });

    it("should trigger Level 2 and pause protocol", async function () {
      await emergencyProtocol.connect(guardian).triggerLevel2(
        1, "Oracle failure", SAMPLE_HASH
      );
      expect(await emergencyProtocol.currentLevel()).to.equal(2n);
      expect(await emergencyProtocol.paused()).to.be.true;
    });

    it("should trigger Level 3 (SUPER_ADMIN only)", async function () {
      await emergencyProtocol.connect(admin).triggerLevel3(
        5, "External attack", SAMPLE_HASH
      );
      expect(await emergencyProtocol.currentLevel()).to.equal(3n);
    });

    it("should reject Level 3 from non-admin", async function () {
      await expect(
        emergencyProtocol.connect(guardian).triggerLevel3(5, "attack", SAMPLE_HASH)
      ).to.be.reverted;
    });

    it("should register circuit breakers", async function () {
      await emergencyProtocol.connect(admin).registerContract(
        await notaryNFT.getAddress(), "NotaryNFT"
      );
      const cb = await emergencyProtocol.getCircuitBreaker(await notaryNFT.getAddress());
      expect(cb.isActive).to.be.true;
    });

    it("should resolve an emergency", async function () {
      const tx = await emergencyProtocol.connect(admin).triggerLevel3(5, "test", SAMPLE_HASH);
      await tx.wait();
      await emergencyProtocol.connect(admin).resolveEmergency(1n, 0n); // Resolve to NONE
      expect(await emergencyProtocol.currentLevel()).to.equal(0n);
    });

    it("should report correct transfer limit per level", async function () {
      expect(await emergencyProtocol.getTransferLimit())
        .to.equal(ethers.MaxUint256);

      await emergencyProtocol.connect(guardian).triggerLevel1(0, "test", SAMPLE_HASH);
      expect(await emergencyProtocol.getTransferLimit())
        .to.equal(ethers.parseEther("10000"));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. AIEngine
  // ─────────────────────────────────────────────────────────────────────────

  describe("AIEngine", function () {
    const DocumentCategory = { IDENTITY_DOCUMENT: 0, LEGAL_CONTRACT: 1 };

    it("should have registered oracles", async function () {
      const oracles = await aiEngine.getRegisteredOracles();
      expect(oracles.length).to.equal(3);
    });

    it("should create a validation request", async function () {
      await aiEngine.connect(notary).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, DocumentCategory.LEGAL_CONTRACT, 1n
      );
      const req = await aiEngine.getRequest(1n);
      expect(req.documentHash).to.equal(SAMPLE_HASH);
      expect(req.status).to.equal(0n); // PENDING
    });

    it("should accept oracle responses and reach consensus", async function () {
      await aiEngine.connect(notary).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, DocumentCategory.LEGAL_CONTRACT, 1n
      );

      const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("analysis data"));

      await aiEngine.connect(oracle1).submitOracleResponse(1n, true, 9000n, 500n, true, true, true, false, analysisHash);
      await aiEngine.connect(oracle2).submitOracleResponse(1n, true, 8500n, 300n, true, true, true, false, analysisHash);

      const req = await aiEngine.getRequest(1n);
      expect(req.status).to.equal(1n); // CONSENSUS (2/3 agree = threshold met)
    });

    it("should reject document with high fraud score", async function () {
      await aiEngine.connect(notary).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, DocumentCategory.LEGAL_CONTRACT, 1n
      );

      const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("fraud analysis"));
      await aiEngine.connect(oracle1).submitOracleResponse(
        1n, false, 2000n, 8000n, false, false, false, true, analysisHash
      );

      const req = await aiEngine.getRequest(1n);
      expect(req.status).to.equal(2n); // REJECTED
    });

    it("should issue a validation certificate on consensus", async function () {
      await aiEngine.connect(notary).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, DocumentCategory.LEGAL_CONTRACT, 1n
      );

      const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("analysis"));
      await aiEngine.connect(oracle1).submitOracleResponse(1n, true, 9000n, 100n, true, true, true, false, analysisHash);
      await aiEngine.connect(oracle2).submitOracleResponse(1n, true, 8800n, 100n, true, true, true, false, analysisHash);

      const cert = await aiEngine.getCertificate(1n);
      expect(cert.isValid).to.be.true;
      expect(cert.documentHash).to.equal(SAMPLE_HASH);
    });

    it("should expire a timed-out request", async function () {
      await aiEngine.connect(admin).setRequestTimeout(3600n);
      await aiEngine.connect(notary).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, DocumentCategory.LEGAL_CONTRACT, 0n
      );

      await time.increase(3700);

      await aiEngine.expireRequest(1n);
      const req = await aiEngine.getRequest(1n);
      expect(req.status).to.equal(4n); // EXPIRED
    });

    it("should cancel a pending request", async function () {
      await aiEngine.connect(notary).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, DocumentCategory.LEGAL_CONTRACT, 0n
      );
      await aiEngine.connect(notary).cancelValidation(1n);
      const req = await aiEngine.getRequest(1n);
      expect(req.status).to.equal(5n); // CANCELLED
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. OracleManager
  // ─────────────────────────────────────────────────────────────────────────

  describe("OracleManager", function () {
    const FEED_ID = ethers.keccak256(ethers.toUtf8Bytes("ETH_USD"));

    beforeEach(async function () {
      const DATA_PROVIDER = await oracleManager.DATA_PROVIDER();
      await oracleManager.grantRole(DATA_PROVIDER, oracle1.address);

      await oracleManager.connect(admin).registerFeed(
        FEED_ID, "ETH/USD", "Ethereum price in USD", 0,
        oracle1.address, oracle2.address, 3600n, 7200n, 500n, 8
      );
    });

    it("should register a feed", async function () {
      const feed = await oracleManager.getFeed(FEED_ID);
      expect(feed.name).to.equal("ETH/USD");
      expect(feed.status).to.equal(0n); // ACTIVE
    });

    it("should accept oracle price updates", async function () {
      const proof = ethers.keccak256(ethers.toUtf8Bytes("price proof"));
      await oracleManager.connect(oracle1).submitAnswer(FEED_ID, 350000000000n, proof);

      const CONSUMER_ROLE = await oracleManager.CONSUMER_ROLE();
      await oracleManager.grantRole(CONSUMER_ROLE, user1.address);

      const priceData = await oracleManager.connect(user1).getLatestPrice(FEED_ID);
      expect(priceData.answer).to.equal(350000000000n);
    });

    it("should update document valuation", async function () {
      await oracleManager.connect(oracle1).updateDocumentValuation(
        SAMPLE_HASH, ethers.parseEther("50000")
      );
      const [val, ts, isCached] = await oracleManager.getDocumentValuation(SAMPLE_HASH);
      expect(val).to.equal(ethers.parseEther("50000"));
      expect(isCached).to.be.true;
    });

    it("should report health metrics", async function () {
      const [total, active, degraded, offline] = await oracleManager.getHealthReport();
      expect(total).to.equal(1n);
      expect(active).to.equal(1n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. ValidationOracle (Commit-Reveal)
  // ─────────────────────────────────────────────────────────────────────────

  describe("ValidationOracle", function () {
    const VoteValue = { APPROVE: 0, REJECT: 1, ABSTAIN: 2 };

    it("should register validators", async function () {
      const pool = await validationOracle.getValidatorPool();
      expect(pool.length).to.equal(3);
    });

    it("should create a voting round", async function () {
      await validationOracle.connect(admin).createVotingRound(SAMPLE_HASH);
      const round = await validationOracle.getRound(1n);
      expect(round.documentHash).to.equal(SAMPLE_HASH);
      expect(round.result).to.equal(0n); // PENDING
    });

    it("should complete full commit-reveal voting cycle", async function () {
      await validationOracle.connect(admin).createVotingRound(SAMPLE_HASH);

      const salt1 = ethers.randomBytes(32);
      const salt2 = ethers.randomBytes(32);
      const salt3 = ethers.randomBytes(32);

      // Compute commitments
      const commit1 = ethers.keccak256(ethers.solidityPacked(
        ["uint8", "bytes32", "address"], [VoteValue.APPROVE, salt1, oracle1.address]
      ));
      const commit2 = ethers.keccak256(ethers.solidityPacked(
        ["uint8", "bytes32", "address"], [VoteValue.APPROVE, salt2, oracle2.address]
      ));
      const commit3 = ethers.keccak256(ethers.solidityPacked(
        ["uint8", "bytes32", "address"], [VoteValue.REJECT, salt3, oracle3.address]
      ));

      // Commit phase
      await validationOracle.connect(oracle1).commitVote(1n, commit1);
      await validationOracle.connect(oracle2).commitVote(1n, commit2);
      await validationOracle.connect(oracle3).commitVote(1n, commit3);

      // Move time past commit deadline
      await time.increase(7201);

      // Reveal phase
      await validationOracle.connect(oracle1).revealVote(1n, VoteValue.APPROVE, salt1);
      await validationOracle.connect(oracle2).revealVote(1n, VoteValue.APPROVE, salt2);
      await validationOracle.connect(oracle3).revealVote(1n, VoteValue.REJECT, salt3);

      // Move time past reveal deadline
      await time.increase(1801);

      // Finalize
      await validationOracle.finalizeRound(1n);
      const round = await validationOracle.getRound(1n);

      expect(round.finalized).to.be.true;
      expect(round.result).to.equal(1n); // APPROVED (2/3 approve with majority weight)
    });

    it("should update validator reputation on finalization", async function () {
      await validationOracle.connect(admin).createVotingRound(SAMPLE_HASH);

      const salt1 = ethers.randomBytes(32);
      const salt2 = ethers.randomBytes(32);
      const salt3 = ethers.randomBytes(32);

      const commit1 = ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32", "address"], [VoteValue.APPROVE, salt1, oracle1.address]));
      const commit2 = ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32", "address"], [VoteValue.APPROVE, salt2, oracle2.address]));
      const commit3 = ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32", "address"], [VoteValue.REJECT,  salt3, oracle3.address]));

      await validationOracle.connect(oracle1).commitVote(1n, commit1);
      await validationOracle.connect(oracle2).commitVote(1n, commit2);
      await validationOracle.connect(oracle3).commitVote(1n, commit3);

      await time.increase(7201);

      await validationOracle.connect(oracle1).revealVote(1n, VoteValue.APPROVE, salt1);
      await validationOracle.connect(oracle2).revealVote(1n, VoteValue.APPROVE, salt2);
      await validationOracle.connect(oracle3).revealVote(1n, VoteValue.REJECT, salt3);

      await time.increase(1801);
      await validationOracle.finalizeRound(1n);

      const v1 = await validationOracle.getValidatorInfo(oracle1.address);
      const v3 = await validationOracle.getValidatorInfo(oracle3.address);

      expect(v1.reputation).to.equal(5050n); // Gained 50
      expect(v3.reputation).to.equal(4800n); // Lost 200
    });

    it("should slash a validator", async function () {
      await validationOracle.connect(admin).slashValidator(oracle1.address, "Evidence of manipulation");
      const v = await validationOracle.getValidatorInfo(oracle1.address);
      expect(v.reputation).to.be.lessThan(5000n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. DocumentSecurityToken
  // ─────────────────────────────────────────────────────────────────────────

  describe("DocumentSecurityToken", function () {
    let dst;

    beforeEach(async function () {
      const DST = await ethers.getContractFactory("DocumentSecurityToken");
      dst = await DST.deploy(
        "Document Security Token",
        "DST",
        SAMPLE_HASH,
        ethers.parseEther("1000000"),
        "US",
        ethers.parseEther("1000"),
        await notaryNFT.getAddress()
      );
      await dst.waitForDeployment();
    });

    it("should deploy with correct token info", async function () {
      const info = await dst.getTokenInfo();
      expect(info.documentHash).to.equal(SAMPLE_HASH);
      expect(info.jurisdiction).to.equal("US");
      expect(info.isFractionalized).to.be.true;
    });

    it("should have correct initial supply minted to admin", async function () {
      const balance = await dst.balanceOf(admin.address);
      expect(balance).to.equal(ethers.parseEther("1000000"));
    });

    it("should freeze and unfreeze accounts", async function () {
      const COMPLIANCE_ROLE = await dst.COMPLIANCE_ROLE();
      await dst.grantRole(COMPLIANCE_ROLE, admin.address);

      await dst.freezeAccount(user1.address);
      expect(await dst.frozenAccounts(user1.address)).to.be.true;

      await dst.unfreezeAccount(user1.address);
      expect(await dst.frozenAccounts(user1.address)).to.be.false;
    });

    it("should enforce accredited investor requirements on transfer", async function () {
      await dst.setAccreditedInvestor(user1.address, true);

      // Transfer below minimum investment to non-accredited should fail
      await expect(
        dst.transfer(user2.address, ethers.parseEther("500")) // below 1000 min
      ).to.be.revertedWith("Minimum investment not met");

      // Transfer to accredited investor should succeed
      await dst.transfer(user1.address, ethers.parseEther("50000"));
      expect(await dst.balanceOf(user1.address)).to.equal(ethers.parseEther("50000"));
    });

    it("should check transfer compliance", async function () {
      const isCompliant = await dst.isTransferCompliant(
        admin.address, user1.address, ethers.parseEther("100")
      );
      // Not an accredited investor and below minimum
      expect(isCompliant).to.be.false;

      await dst.setAccreditedInvestor(user1.address, true);
      const isCompliant2 = await dst.isTransferCompliant(
        admin.address, user1.address, ethers.parseEther("100")
      );
      expect(isCompliant2).to.be.true;
    });

    it("should pause and unpause token transfers", async function () {
      await dst.emergencyPause();
      await expect(
        dst.transfer(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Pausable: paused");

      await dst.emergencyUnpause();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Integration Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("Integration: Full Document Lifecycle", function () {
    it("should complete full notarization pipeline", async function () {
      // Step 1: Register document in registry
      await documentRegistry.connect(user1).registerDocument(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, SAMPLE_IPFS_CID,
        1, // CONTRACT
        SAMPLE_JURISDICTION, 0
      );
      const doc = await documentRegistry.getDocument(1n);
      expect(doc.status).to.equal(0n); // PENDING

      // Step 2: Request AI validation
      const REQUESTOR = await aiEngine.REQUESTOR_ROLE();
      await aiEngine.grantRole(REQUESTOR, user1.address);
      await aiEngine.connect(user1).requestValidation(
        SAMPLE_HASH, SAMPLE_METADATA_HASH, 1n, 1n
      );

      // Step 3: Oracles respond
      const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("ai analysis result"));
      await aiEngine.connect(oracle1).submitOracleResponse(1n, true, 9000n, 100n, true, true, true, false, analysisHash);
      await aiEngine.connect(oracle2).submitOracleResponse(1n, true, 8800n, 100n, true, true, true, false, analysisHash);

      // Verify certificate issued
      const cert = await aiEngine.getCertificate(1n);
      expect(cert.isValid).to.be.true;

      // Step 4: Validate in registry
      await documentRegistry.connect(validator).validateDocument(1n);

      // Step 5: Mint NotaryNFT
      await notaryNFT.connect(notary).mintNotarySeal(
        user1.address, SAMPLE_HASH, SAMPLE_METADATA_HASH,
        SAMPLE_IPFS_CID, SAMPLE_JURISDICTION, 1, // CONTRACT
        Math.floor(Date.now() / 1000), 0, 1n, 9000n, 0,
        `ipfs://${SAMPLE_IPFS_CID}`
      );
      expect(await notaryNFT.ownerOf(1n)).to.equal(user1.address);

      // Step 6: Notarize in registry (link to NFT)
      await documentRegistry.connect(notary).notarizeDocument(1n, 1n);
      const finalDoc = await documentRegistry.getDocument(1n);
      expect(finalDoc.status).to.equal(2n); // NOTARIZED
      expect(finalDoc.tokenId).to.equal(1n);

      // Verify seal is valid
      expect(await notaryNFT.isSealValid(1n)).to.be.true;
    });
  });
});
