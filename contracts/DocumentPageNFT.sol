// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    DocumentPageNFT.sol
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

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title DocumentPageNFT
 * @notice Child NFT contract representing individual pages or bounded asset units
 *         within a finalized notarization session. Each token is provably linked
 *         to a master NotaryNFT token and a DocumentCollectionRegistry entry.
 *
 * @dev Architecture:
 *   - One DocumentPageNFT token per page / asset unit in a notarized document set.
 *   - Every token is bound to a masterTokenId (the NotaryNFT master seal) and a
 *     collectionId (from DocumentCollectionRegistry).
 *   - Minting is gated by MINTER_ROLE and must occur AFTER the session has been
 *     finalized off-chain (enforced in the service layer; this contract records
 *     the finalizedAt timestamp supplied by the authorized minter).
 *   - Visual metadata is deterministically derived on-chain via artSeed, allowing
 *     the off-chain renderer to produce a unique "Living Cipher" SVG for each page
 *     without storing sensitive document content publicly.
 *   - Page NFTs are provenance / collectible sub-assets; they are NOT eligible for
 *     direct fractionalization. Fractionalization targets the master NotaryNFT.
 */
contract DocumentPageNFT is
    ERC721,
    ERC721URIStorage,
    ERC721Enumerable,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE      = keccak256("ADMIN_ROLE");

    Counters.Counter private _tokenIdCounter;

    // ─────────────────────────────────────────────────────────────────────────
    // Page Token Metadata
    // ─────────────────────────────────────────────────────────────────────────

    struct PageToken {
        bytes32  sessionId;         // Notarization session / case ID (keccak256)
        bytes32  collectionId;      // Collection ID from DocumentCollectionRegistry
        uint256  masterTokenId;     // Corresponding NotaryNFT master token ID
        uint256  pageIndex;         // 0-based page index within the document set
        uint256  pageCount;         // Total page count for the session
        bytes32  pageHash;          // SHA-256 hash of this specific page content
        bytes32  documentSetRootHash; // Merkle root of all page hashes (session root)
        bytes32  artSeed;           // Deterministic seed for visual generation
        uint256  mintedAt;          // Block timestamp of minting
        string   manifestCID;       // IPFS CID of the collection manifest (shared)
        string   metadataCID;       // IPFS CID of this token's off-chain metadata
        bool     fractalizationEligible; // Always false for page NFTs
    }

    // tokenId => PageToken
    mapping(uint256 => PageToken) public pageTokens;

    // sessionId + pageIndex => tokenId (uniqueness guard)
    mapping(bytes32 => mapping(uint256 => uint256)) public sessionPageToTokenId;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event PageNFTMinted(
        uint256 indexed tokenId,
        bytes32 indexed sessionId,
        bytes32 indexed collectionId,
        uint256 masterTokenId,
        uint256 pageIndex,
        uint256 pageCount,
        bytes32 pageHash,
        bytes32 artSeed,
        address recipient,
        uint256 timestamp
    );

    event PageMetadataUpdated(
        uint256 indexed tokenId,
        string  newMetadataCID,
        address updatedBy,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin) ERC721("Notary Page NFT", "NOTARY-PAGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Minting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a single page NFT for a finalized notarization session.
     * @dev Caller must have MINTER_ROLE. The service layer enforces that minting
     *      occurs only after off-chain legal finalization succeeds.
     *
     * @param recipient         Token recipient (typically the document signer)
     * @param sessionId         keccak256 of the case/session identifier
     * @param collectionId      Collection ID from DocumentCollectionRegistry
     * @param masterTokenId     Corresponding NotaryNFT token ID
     * @param pageIndex         0-based page index
     * @param pageCount         Total page count
     * @param pageHash          SHA-256 hash of this page
     * @param documentSetRootHash  Merkle root of all page hashes
     * @param manifestCID       IPFS CID of the collection manifest
     * @param metadataCID       IPFS CID of this token's metadata JSON
     * @return tokenId          The minted token ID
     */
    function mintPage(
        address recipient,
        bytes32 sessionId,
        bytes32 collectionId,
        uint256 masterTokenId,
        uint256 pageIndex,
        uint256 pageCount,
        bytes32 pageHash,
        bytes32 documentSetRootHash,
        string calldata manifestCID,
        string calldata metadataCID
    )
        external
        nonReentrant
        whenNotPaused
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        require(recipient != address(0),      "PageNFT: zero recipient");
        require(pageCount > 0,                "PageNFT: zero page count");
        require(pageIndex < pageCount,        "PageNFT: index out of bounds");
        require(pageHash != bytes32(0),       "PageNFT: zero page hash");
        require(documentSetRootHash != bytes32(0), "PageNFT: zero root hash");
        require(
            sessionPageToTokenId[sessionId][pageIndex] == 0,
            "PageNFT: page already minted"
        );

        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();

        // Deterministic visual seed: hash of collection + page index + page hash
        bytes32 artSeed = keccak256(abi.encodePacked(collectionId, pageIndex, pageHash));

        pageTokens[tokenId] = PageToken({
            sessionId:            sessionId,
            collectionId:         collectionId,
            masterTokenId:        masterTokenId,
            pageIndex:            pageIndex,
            pageCount:            pageCount,
            pageHash:             pageHash,
            documentSetRootHash:  documentSetRootHash,
            artSeed:              artSeed,
            mintedAt:             block.timestamp,
            manifestCID:          manifestCID,
            metadataCID:          metadataCID,
            fractalizationEligible: false   // Page NFTs are never fractionalized
        });

        sessionPageToTokenId[sessionId][pageIndex] = tokenId;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataCID);

        emit PageNFTMinted(
            tokenId, sessionId, collectionId, masterTokenId,
            pageIndex, pageCount, pageHash, artSeed, recipient, block.timestamp
        );
    }

    /**
     * @notice Batch-mint all page NFTs for a session in one transaction.
     * @dev Iterates over parallel arrays; arrays must have identical length.
     */
    function mintPageBatch(
        address           recipient,
        bytes32           sessionId,
        bytes32           collectionId,
        uint256           masterTokenId,
        uint256           pageCount,
        bytes32[] calldata pageHashes,
        bytes32           documentSetRootHash,
        string  calldata  manifestCID,
        string[] calldata metadataCIDs
    )
        external
        nonReentrant
        whenNotPaused
        onlyRole(MINTER_ROLE)
        returns (uint256[] memory tokenIds)
    {
        require(pageHashes.length == pageCount,    "PageNFT: hash count mismatch");
        require(metadataCIDs.length == pageCount,  "PageNFT: cid count mismatch");

        tokenIds = new uint256[](pageCount);

        for (uint256 i = 0; i < pageCount; i++) {
            require(pageHashes[i] != bytes32(0), "PageNFT: zero hash in batch");
            require(
                sessionPageToTokenId[sessionId][i] == 0,
                "PageNFT: page already minted in batch"
            );

            _tokenIdCounter.increment();
            uint256 tokenId = _tokenIdCounter.current();
            bytes32 artSeed = keccak256(abi.encodePacked(collectionId, i, pageHashes[i]));

            pageTokens[tokenId] = PageToken({
                sessionId:            sessionId,
                collectionId:         collectionId,
                masterTokenId:        masterTokenId,
                pageIndex:            i,
                pageCount:            pageCount,
                pageHash:             pageHashes[i],
                documentSetRootHash:  documentSetRootHash,
                artSeed:              artSeed,
                mintedAt:             block.timestamp,
                manifestCID:          manifestCID,
                metadataCID:          metadataCIDs[i],
                fractalizationEligible: false
            });

            sessionPageToTokenId[sessionId][i] = tokenId;
            _safeMint(recipient, tokenId);
            _setTokenURI(tokenId, metadataCIDs[i]);

            emit PageNFTMinted(
                tokenId, sessionId, collectionId, masterTokenId,
                i, pageCount, pageHashes[i], artSeed, recipient, block.timestamp
            );

            tokenIds[i] = tokenId;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Metadata
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the off-chain metadata CID for a page token.
     * @dev Only callable by ADMIN_ROLE; intended for post-render metadata updates.
     */
    function updateMetadataCID(uint256 tokenId, string calldata newCID)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(_exists(tokenId), "PageNFT: token does not exist");
        pageTokens[tokenId].metadataCID = newCID;
        _setTokenURI(tokenId, newCID);
        emit PageMetadataUpdated(tokenId, newCID, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function getPageToken(uint256 tokenId) external view returns (PageToken memory) {
        require(_exists(tokenId), "PageNFT: token does not exist");
        return pageTokens[tokenId];
    }

    function getTokenIdForPage(bytes32 sessionId, uint256 pageIndex)
        external
        view
        returns (uint256)
    {
        return sessionPageToTokenId[sessionId][pageIndex];
    }

    function totalSupply() public view override(ERC721Enumerable) returns (uint256) {
        return _tokenIdCounter.current();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Required Overrides
    // ─────────────────────────────────────────────────────────────────────────

    function _beforeTokenTransfer(
        address from, address to, uint256 tokenId, uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
