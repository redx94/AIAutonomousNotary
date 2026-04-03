/**
 * ============================================================================
 * File:      NFTCollection.test.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title NFT Collection Architecture Tests
 * @notice Verifies the Master NFT + Page NFT + Collection Registry model:
 *   1. Master/session asset mint occurs only after finalization path succeeds
 *   2. Collection/page minting is tied to the correct session/case
 *   3. Page NFTs are provably linked to the master / collection
 *   4. Fractionalization still targets the correct root/master asset
 *   5. Mint failure does not erase legal finalization
 *   6. Correct registry state transitions
 */
describe("NFT Collection Architecture", function () {
  // ─── Signers ──────────────────────────────────────────────────────────────
  let admin, minter, recipient, attacker;

  // ─── Contracts ────────────────────────────────────────────────────────────
  let registry;    // DocumentCollectionRegistry
  let pageNFT;     // DocumentPageNFT

  // ─── Shared test data ─────────────────────────────────────────────────────
  const SESSION_ID       = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("case-001"));
  const ROOT_HASH        = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("rootHash-001"));
  const MANIFEST_HASH    = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("manifestHash-001"));
  const MANIFEST_CID     = "QmManifestTest001";
  const PAGE_HASH_0      = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pageHash-page0"));
  const PAGE_HASH_1      = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("pageHash-page1"));

  beforeEach(async function () {
    [admin, minter, recipient, attacker] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("DocumentCollectionRegistry");
    registry = await Registry.deploy(admin.address);
    await registry.deployed();

    const PageNFT = await ethers.getContractFactory("DocumentPageNFT");
    pageNFT = await PageNFT.deploy(admin.address);
    await pageNFT.deployed();

    // Grant MINTER_ROLE to minter on both contracts
    const MINTER_ROLE = await registry.MINTER_ROLE();
    await registry.connect(admin).grantRole(MINTER_ROLE, minter.address);

    const PAGE_MINTER_ROLE = await pageNFT.MINTER_ROLE();
    await pageNFT.connect(admin).grantRole(PAGE_MINTER_ROLE, minter.address);
  });

  // ─── DocumentCollectionRegistry ───────────────────────────────────────────

  describe("DocumentCollectionRegistry — registration", function () {
    it("registers a collection for a finalized session", async function () {
      const tx = await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const receipt = await tx.wait();

      // Check event was emitted
      const evt = receipt.events.find(e => e.event === "CollectionRegistered");
      expect(evt).to.not.be.undefined;
      expect(evt.args.sessionId).to.equal(SESSION_ID);
      expect(evt.args.pageCount).to.equal(2);
      expect(evt.args.recipient).to.equal(recipient.address);
    });

    it("generates a non-zero unique collectionId", async function () {
      await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const col = await registry.getCollectionBySession(SESSION_ID);
      expect(col.collectionId).to.not.equal(ethers.constants.HashZero);
    });

    it("sets initial mintStatus to PENDING (0)", async function () {
      await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const col = await registry.getCollectionBySession(SESSION_ID);
      expect(col.mintStatus).to.equal(0); // MintStatus.PENDING
    });

    it("marks master token as fractionalization eligible", async function () {
      await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const col = await registry.getCollectionBySession(SESSION_ID);
      expect(col.fractionalizationEligible).to.be.true;
    });

    it("rejects duplicate registration for same session", async function () {
      await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      await expect(
        registry.connect(minter).registerCollection(
          SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
        )
      ).to.be.revertedWith("Registry: session already registered");
    });

    it("rejects registration without MINTER_ROLE", async function () {
      await expect(
        registry.connect(attacker).registerCollection(
          SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
        )
      ).to.be.reverted;
    });
  });

  describe("DocumentCollectionRegistry — status transitions", function () {
    let collectionIndex;
    let collectionId;

    beforeEach(async function () {
      const tx = await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const receipt = await tx.wait();
      const evt = receipt.events.find(e => e.event === "CollectionRegistered");
      collectionIndex = evt.args.collectionIndex;
      collectionId    = evt.args.collectionId;
    });

    it("transitions PENDING → PREPARING", async function () {
      await registry.connect(minter).setMintStatus(collectionIndex, 1); // PREPARING
      const status = await registry.getMintStatus(collectionIndex);
      expect(status).to.equal(1);
    });

    it("transitions PREPARING → MINTED and records mintedAt", async function () {
      await registry.connect(minter).setMintStatus(collectionIndex, 1); // PREPARING
      await registry.connect(minter).setMintStatus(collectionIndex, 2); // MINTED
      const col = await registry.getCollection(collectionIndex);
      expect(col.mintStatus).to.equal(2);
      expect(col.mintedAt).to.be.gt(0);
    });

    it("transitions PREPARING → FAILED", async function () {
      await registry.connect(minter).setMintStatus(collectionIndex, 1); // PREPARING
      await registry.connect(minter).setMintStatus(collectionIndex, 3); // FAILED
      const status = await registry.getMintStatus(collectionIndex);
      expect(status).to.equal(3);
    });

    it("allows FAILED → PREPARING (retry path)", async function () {
      await registry.connect(minter).setMintStatus(collectionIndex, 1); // PREPARING
      await registry.connect(minter).setMintStatus(collectionIndex, 3); // FAILED
      await registry.connect(minter).setMintStatus(collectionIndex, 1); // PREPARING again
      const status = await registry.getMintStatus(collectionIndex);
      expect(status).to.equal(1);
    });

    it("rejects invalid transition PENDING → MINTED", async function () {
      await expect(
        registry.connect(minter).setMintStatus(collectionIndex, 2) // MINTED without PREPARING
      ).to.be.revertedWith("Registry: invalid transition to MINTED");
    });

    it("sets master token after mint", async function () {
      await registry.connect(minter).setMasterToken(collectionIndex, 42);
      const col = await registry.getCollection(collectionIndex);
      expect(col.masterTokenId).to.equal(42);
    });

    it("rejects duplicate master token set", async function () {
      await registry.connect(minter).setMasterToken(collectionIndex, 42);
      await expect(
        registry.connect(minter).setMasterToken(collectionIndex, 99)
      ).to.be.revertedWith("Registry: master already set");
    });

    it("sets page token IDs after mint", async function () {
      await registry.connect(minter).setPageTokens(collectionIndex, [43, 44]);
      const ids = await registry.getPageTokenIds(collectionIndex);
      expect(ids.map(id => id.toNumber())).to.deep.equal([43, 44]);
    });
  });

  // ─── Proof that mint failure does NOT affect legal record ─────────────────

  describe("Mint failure isolation", function () {
    it("a FAILED mint status does not revert registry data (legal record preserved)", async function () {
      const tx = await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const receipt = await tx.wait();
      const evt = receipt.events.find(e => e.event === "CollectionRegistered");
      const idx = evt.args.collectionIndex;

      await registry.connect(minter).setMintStatus(idx, 1); // PREPARING
      await registry.connect(minter).setMintStatus(idx, 3); // FAILED

      // Collection (legal) record still intact
      const col = await registry.getCollection(idx);
      expect(col.sessionId).to.equal(SESSION_ID);
      expect(col.documentSetRootHash).to.equal(ROOT_HASH);
      expect(col.recipient).to.equal(recipient.address);
      expect(col.mintStatus).to.equal(3); // FAILED, but data intact

      // Retry is possible
      await registry.connect(minter).setMintStatus(idx, 1); // PREPARING again
      const status = await registry.getMintStatus(idx);
      expect(status).to.equal(1);
    });
  });

  // ─── DocumentPageNFT ──────────────────────────────────────────────────────

  describe("DocumentPageNFT — minting", function () {
    let collectionId;
    const MASTER_TOKEN_ID = 10;

    beforeEach(async function () {
      const tx = await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const receipt = await tx.wait();
      const evt = receipt.events.find(e => e.event === "CollectionRegistered");
      collectionId = evt.args.collectionId;
    });

    it("mints a page NFT with correct metadata", async function () {
      const tx = await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID,
        collectionId,
        MASTER_TOKEN_ID,
        0,             // pageIndex
        2,             // pageCount
        PAGE_HASH_0,
        ROOT_HASH,
        MANIFEST_CID,
        "ipfs://QmPageMeta001"
      );
      const receipt = await tx.wait();
      const evt = receipt.events.find(e => e.event === "PageNFTMinted");
      expect(evt).to.not.be.undefined;
      expect(evt.args.pageIndex).to.equal(0);
      expect(evt.args.masterTokenId).to.equal(MASTER_TOKEN_ID);
      expect(evt.args.collectionId).to.equal(collectionId);
      expect(evt.args.recipient).to.equal(recipient.address);
    });

    it("page NFT is bound to the master token and collection", async function () {
      const tx = await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID,
        collectionId,
        MASTER_TOKEN_ID,
        0, 2,
        PAGE_HASH_0,
        ROOT_HASH,
        MANIFEST_CID,
        "ipfs://QmPageMeta001"
      );
      const receipt = await tx.wait();
      const mintedId = receipt.events.find(e => e.event === "PageNFTMinted").args.tokenId;

      const page = await pageNFT.getPageToken(mintedId);
      expect(page.masterTokenId).to.equal(MASTER_TOKEN_ID);
      expect(page.collectionId).to.equal(collectionId);
      expect(page.sessionId).to.equal(SESSION_ID);
      expect(page.pageHash).to.equal(PAGE_HASH_0);
    });

    it("page NFT is NOT fractionalization eligible", async function () {
      const tx = await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID, collectionId, MASTER_TOKEN_ID,
        0, 2, PAGE_HASH_0, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta001"
      );
      const receipt = await tx.wait();
      const mintedId = receipt.events.find(e => e.event === "PageNFTMinted").args.tokenId;
      const page = await pageNFT.getPageToken(mintedId);
      expect(page.fractalizationEligible).to.be.false;
    });

    it("generates a deterministic artSeed from collectionId + pageIndex + pageHash", async function () {
      const tx = await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID, collectionId, MASTER_TOKEN_ID,
        0, 2, PAGE_HASH_0, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta001"
      );
      const receipt = await tx.wait();
      const mintedId = receipt.events.find(e => e.event === "PageNFTMinted").args.tokenId;
      const page = await pageNFT.getPageToken(mintedId);

      const expectedArtSeed = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "uint256", "bytes32"], [collectionId, 0, PAGE_HASH_0])
      );
      expect(page.artSeed).to.equal(expectedArtSeed);
    });

    it("rejects minting the same page index twice (uniqueness guard)", async function () {
      await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID, collectionId, MASTER_TOKEN_ID,
        0, 2, PAGE_HASH_0, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta001"
      );
      await expect(
        pageNFT.connect(minter).mintPage(
          recipient.address,
          SESSION_ID, collectionId, MASTER_TOKEN_ID,
          0, 2, PAGE_HASH_0, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta001-dup"
        )
      ).to.be.revertedWith("PageNFT: page already minted");
    });

    it("rejects minting without MINTER_ROLE", async function () {
      await expect(
        pageNFT.connect(attacker).mintPage(
          recipient.address,
          SESSION_ID, collectionId, MASTER_TOKEN_ID,
          0, 2, PAGE_HASH_0, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta001"
        )
      ).to.be.reverted;
    });

    it("batch mints all pages in one transaction", async function () {
      const tx = await pageNFT.connect(minter).mintPageBatch(
        recipient.address,
        SESSION_ID, collectionId, MASTER_TOKEN_ID,
        2,
        [PAGE_HASH_0, PAGE_HASH_1],
        ROOT_HASH,
        MANIFEST_CID,
        ["ipfs://QmPage0", "ipfs://QmPage1"]
      );
      const receipt = await tx.wait();
      const events = receipt.events.filter(e => e.event === "PageNFTMinted");
      expect(events).to.have.lengthOf(2);
      expect(events[0].args.pageIndex).to.equal(0);
      expect(events[1].args.pageIndex).to.equal(1);
    });

    it("looks up token by session + page index", async function () {
      const tx = await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID, collectionId, MASTER_TOKEN_ID,
        1, 2, PAGE_HASH_1, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta002"
      );
      const receipt = await tx.wait();
      const mintedId = receipt.events.find(e => e.event === "PageNFTMinted").args.tokenId;

      const lookedUp = await pageNFT.getTokenIdForPage(SESSION_ID, 1);
      expect(lookedUp).to.equal(mintedId);
    });
  });

  // ─── Fractionalization targeting the Master NFT ───────────────────────────

  describe("Fractionalization eligibility", function () {
    it("master token is fractionalization eligible", async function () {
      await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const col = await registry.getCollectionBySession(SESSION_ID);
      expect(col.fractionalizationEligible).to.be.true;
    });

    it("page NFTs are NOT fractionalization eligible", async function () {
      const tx = await registry.connect(minter).registerCollection(
        SESSION_ID, 2, ROOT_HASH, MANIFEST_HASH, MANIFEST_CID, recipient.address
      );
      const receipt = await tx.wait();
      const collectionId = receipt.events.find(e => e.event === "CollectionRegistered").args.collectionId;

      const pageTx = await pageNFT.connect(minter).mintPage(
        recipient.address,
        SESSION_ID, collectionId, 1,
        0, 2, PAGE_HASH_0, ROOT_HASH, MANIFEST_CID, "ipfs://QmPageMeta001"
      );
      const pageReceipt = await pageTx.wait();
      const pageTokenId = pageReceipt.events.find(e => e.event === "PageNFTMinted").args.tokenId;

      const page = await pageNFT.getPageToken(pageTokenId);
      expect(page.fractalizationEligible).to.be.false;
    });
  });
});
