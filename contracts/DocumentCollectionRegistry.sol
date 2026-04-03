// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    DocumentCollectionRegistry.sol
 * @author   Reece Dixon
 * @project  AI Autonomous Notary Protocol
 * @date     2026
 *
 * @notice   Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 *           Unauthorized copying, modification, or commercial use of this file,
 *           via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title DocumentCollectionRegistry
 * @notice On-chain manifest and relationship layer for notarized document
 *         set collections. Ties together:
 *           - one Master NotaryNFT (root legal / economic token)
 *           - zero or more DocumentPageNFTs (child provenance / collectible tokens)
 *           - a unique session / case identity
 *           - collection-level hashes and IPFS references
 *
 * @dev Architecture notes:
 *   1. A collection is created AFTER off-chain legal finalization succeeds.
 *      The service layer enforces this; the registry records the state supplied
 *      by the authorized caller.
 *   2. Only the master NotaryNFT is eligible for fractionalization.
 *      Page NFTs are provenance / collectible sub-assets.
 *   3. Visual seeds are derived deterministically so the renderer can generate
 *      coherent "Living Cipher" artwork for the whole collection without
 *      exposing sensitive document content on-chain.
 *   4. The registry is the authoritative on-chain source of truth for collection
 *      composition, mint status, and the relationship between master and page tokens.
 */
contract DocumentCollectionRegistry is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant REGISTRY_ADMIN  = keccak256("REGISTRY_ADMIN");
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");

    Counters.Counter private _collectionIdCounter;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Lifecycle states for an NFT collection tied to a notarization session.
     * @dev These states are DOWNSTREAM of off-chain legal finalization.
     *      PENDING     — session finalized; collection entry registered, minting not started
     *      PREPARING   — mint transaction in flight
     *      MINTED      — master + all page NFTs successfully minted
     *      FAILED      — minting failed (legal record unaffected; retry is possible)
     */
    enum MintStatus { PENDING, PREPARING, MINTED, FAILED }

    // ─────────────────────────────────────────────────────────────────────────
    // Collection Record
    // ─────────────────────────────────────────────────────────────────────────

    struct Collection {
        bytes32  sessionId;             // keccak256 of the off-chain case/session ID
        bytes32  collectionId;          // Registry-generated unique collection identity
        uint256  masterTokenId;         // NotaryNFT master seal token ID (set after mint)
        uint256[] pageTokenIds;         // DocumentPageNFT token IDs (set after mint)
        uint256  pageCount;             // Total number of pages / asset units
        bytes32  documentSetRootHash;   // Merkle root of all page hashes
        bytes32  manifestHash;          // Hash of the off-chain collection manifest JSON
        string   manifestCID;           // IPFS CID of the collection manifest
        bytes32  artSeed;               // Master visual seed (drives Living Cipher master artwork)
        address  recipient;             // Document signer / asset recipient
        uint256  registeredAt;          // Block timestamp of collection registration
        uint256  mintedAt;              // Block timestamp when MINTED status reached
        MintStatus mintStatus;
        bool     fractionalizationEligible; // True — master token can be fractionalized
    }

    // collectionIndex => Collection
    mapping(uint256 => Collection) private _collections;

    // sessionId => collectionIndex (uniqueness: one collection per session)
    mapping(bytes32 => uint256) public sessionToCollectionIndex;

    // collectionId (bytes32) => collectionIndex
    mapping(bytes32 => uint256) public collectionIdToIndex;

    // Total count
    uint256 public totalCollections;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event CollectionRegistered(
        uint256 indexed collectionIndex,
        bytes32 indexed sessionId,
        bytes32 indexed collectionId,
        address recipient,
        uint256 pageCount,
        bytes32 documentSetRootHash,
        uint256 timestamp
    );

    event MintStatusUpdated(
        uint256 indexed collectionIndex,
        bytes32 indexed collectionId,
        MintStatus oldStatus,
        MintStatus newStatus,
        uint256 timestamp
    );

    event MasterTokenSet(
        uint256 indexed collectionIndex,
        bytes32 indexed collectionId,
        uint256 masterTokenId,
        uint256 timestamp
    );

    event PageTokensSet(
        uint256 indexed collectionIndex,
        bytes32 indexed collectionId,
        uint256[] pageTokenIds,
        uint256 timestamp
    );

    event ManifestUpdated(
        uint256 indexed collectionIndex,
        bytes32 indexed collectionId,
        bytes32 manifestHash,
        string  manifestCID,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ADMIN, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new collection entry for a finalized notarization session.
     * @dev One session maps to exactly one collection. Call this AFTER off-chain
     *      legal finalization succeeds, before initiating the mint transactions.
     *
     * @param sessionId           keccak256 of the off-chain case / session string ID
     * @param pageCount           Total number of pages in the document set
     * @param documentSetRootHash Merkle root of all page content hashes
     * @param manifestHash        Hash of the off-chain manifest JSON
     * @param manifestCID         IPFS CID of the manifest JSON
     * @param recipient           Address that will receive the minted NFTs
     * @return collectionIndex    Auto-incremented on-chain index for this collection
     * @return collectionId       Unique deterministic bytes32 identity for the collection
     */
    function registerCollection(
        bytes32 sessionId,
        uint256 pageCount,
        bytes32 documentSetRootHash,
        bytes32 manifestHash,
        string calldata manifestCID,
        address recipient
    )
        external
        nonReentrant
        whenNotPaused
        onlyRole(MINTER_ROLE)
        returns (uint256 collectionIndex, bytes32 collectionId)
    {
        require(sessionId != bytes32(0),              "Registry: zero sessionId");
        require(documentSetRootHash != bytes32(0),    "Registry: zero rootHash");
        require(manifestHash != bytes32(0),           "Registry: zero manifestHash");
        require(recipient != address(0),              "Registry: zero recipient");
        require(
            sessionToCollectionIndex[sessionId] == 0,
            "Registry: session already registered"
        );

        _collectionIdCounter.increment();
        collectionIndex = _collectionIdCounter.current();

        // Deterministic collection identity: hash of sessionId + rootHash + block data
        collectionId = keccak256(
            abi.encodePacked(sessionId, documentSetRootHash, block.timestamp, collectionIndex)
        );

        // Master visual seed (shared across master + all child NFTs)
        bytes32 artSeed = keccak256(abi.encodePacked(collectionId, sessionId, documentSetRootHash));

        Collection storage col = _collections[collectionIndex];
        col.sessionId             = sessionId;
        col.collectionId          = collectionId;
        col.masterTokenId         = 0;           // Set when master NFT is minted
        col.pageCount             = pageCount;
        col.documentSetRootHash   = documentSetRootHash;
        col.manifestHash          = manifestHash;
        col.manifestCID           = manifestCID;
        col.artSeed               = artSeed;
        col.recipient             = recipient;
        col.registeredAt          = block.timestamp;
        col.mintedAt              = 0;
        col.mintStatus            = MintStatus.PENDING;
        col.fractionalizationEligible = true;    // Master NFT is always eligible

        sessionToCollectionIndex[sessionId]     = collectionIndex;
        collectionIdToIndex[collectionId]       = collectionIndex;
        totalCollections++;

        emit CollectionRegistered(
            collectionIndex, sessionId, collectionId,
            recipient, pageCount, documentSetRootHash, block.timestamp
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Post-Mint Updates
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record the master NotaryNFT token ID after it has been minted.
     */
    function setMasterToken(uint256 collectionIndex, uint256 masterTokenId)
        external
        onlyRole(MINTER_ROLE)
    {
        Collection storage col = _collections[collectionIndex];
        require(col.sessionId != bytes32(0), "Registry: collection not found");
        require(col.masterTokenId == 0,      "Registry: master already set");

        col.masterTokenId = masterTokenId;

        emit MasterTokenSet(
            collectionIndex, col.collectionId, masterTokenId, block.timestamp
        );
    }

    /**
     * @notice Record the page DocumentPageNFT token IDs after they have been minted.
     */
    function setPageTokens(uint256 collectionIndex, uint256[] calldata pageTokenIds)
        external
        onlyRole(MINTER_ROLE)
    {
        Collection storage col = _collections[collectionIndex];
        require(col.sessionId != bytes32(0),           "Registry: collection not found");
        require(col.pageTokenIds.length == 0,          "Registry: pages already set");
        require(pageTokenIds.length == col.pageCount || col.pageCount == 0,
            "Registry: page count mismatch");

        for (uint256 i = 0; i < pageTokenIds.length; i++) {
            col.pageTokenIds.push(pageTokenIds[i]);
        }

        emit PageTokensSet(
            collectionIndex, col.collectionId, pageTokenIds, block.timestamp
        );
    }

    /**
     * @notice Update the mint status of a collection.
     * @dev Valid transitions:
     *      PENDING     → PREPARING
     *      PREPARING   → MINTED | FAILED
     *      FAILED      → PREPARING  (retry path)
     */
    function setMintStatus(uint256 collectionIndex, MintStatus newStatus)
        external
        onlyRole(MINTER_ROLE)
    {
        Collection storage col = _collections[collectionIndex];
        require(col.sessionId != bytes32(0), "Registry: collection not found");

        MintStatus current = col.mintStatus;

        // Validate transition
        if (newStatus == MintStatus.PREPARING) {
            require(
                current == MintStatus.PENDING || current == MintStatus.FAILED,
                "Registry: invalid transition to PREPARING"
            );
        } else if (newStatus == MintStatus.MINTED) {
            require(current == MintStatus.PREPARING, "Registry: invalid transition to MINTED");
            col.mintedAt = block.timestamp;
        } else if (newStatus == MintStatus.FAILED) {
            require(current == MintStatus.PREPARING, "Registry: invalid transition to FAILED");
        } else {
            revert("Registry: invalid target status");
        }

        col.mintStatus = newStatus;

        emit MintStatusUpdated(
            collectionIndex, col.collectionId, current, newStatus, block.timestamp
        );
    }

    /**
     * @notice Update the manifest hash and CID (e.g. after off-chain enrichment).
     */
    function updateManifest(
        uint256 collectionIndex,
        bytes32 newManifestHash,
        string calldata newManifestCID
    )
        external
        onlyRole(REGISTRY_ADMIN)
    {
        Collection storage col = _collections[collectionIndex];
        require(col.sessionId != bytes32(0), "Registry: collection not found");

        col.manifestHash = newManifestHash;
        col.manifestCID  = newManifestCID;

        emit ManifestUpdated(
            collectionIndex, col.collectionId, newManifestHash, newManifestCID, block.timestamp
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getCollection(uint256 collectionIndex)
        external
        view
        returns (Collection memory)
    {
        require(_collections[collectionIndex].sessionId != bytes32(0), "Registry: not found");
        return _collections[collectionIndex];
    }

    function getCollectionBySession(bytes32 sessionId)
        external
        view
        returns (Collection memory)
    {
        uint256 idx = sessionToCollectionIndex[sessionId];
        require(idx != 0 && _collections[idx].sessionId != bytes32(0), "Registry: not found");
        return _collections[idx];
    }

    function getCollectionById(bytes32 collectionId)
        external
        view
        returns (Collection memory)
    {
        uint256 idx = collectionIdToIndex[collectionId];
        require(idx != 0 && _collections[idx].collectionId == collectionId, "Registry: not found");
        return _collections[idx];
    }

    function getPageTokenIds(uint256 collectionIndex)
        external
        view
        returns (uint256[] memory)
    {
        return _collections[collectionIndex].pageTokenIds;
    }

    function getMintStatus(uint256 collectionIndex)
        external
        view
        returns (MintStatus)
    {
        return _collections[collectionIndex].mintStatus;
    }

    function isSessionRegistered(bytes32 sessionId) external view returns (bool) {
        return sessionToCollectionIndex[sessionId] != 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(REGISTRY_ADMIN) { _pause(); }
    function unpause() external onlyRole(REGISTRY_ADMIN) { _unpause(); }
}
