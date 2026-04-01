// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 Reece Dixon - All Rights Reserved.
// This file is part of AI Autonomous Notary.
// Unauthorized copying, modification, or commercial use of this file,
// via any medium, is strictly prohibited until the Change Date.

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title NotaryNFT
 * @author AI Autonomous Notary Protocol
 * @notice Enhanced ERC-721 notary seal NFT with programmable on-chain metadata,
 *         AI validation attestations, multi-party signature support, and
 *         compliance-ready transfer restrictions.
 * @dev Each NotaryNFT represents a unique notary seal for a specific document.
 *      Metadata is fully on-chain (not just a URI pointer) for immutability.
 *      Supports EIP-712 typed structured data signing for off-chain approvals.
 */
contract NotaryNFT is
    ERC721,
    ERC721URIStorage,
    ERC721Enumerable,
    ERC721Burnable,
    ERC2981,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    EIP712
{
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant NOTARY_ROLE       = keccak256("NOTARY_ROLE");
    bytes32 public constant MINTER_ROLE       = keccak256("MINTER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE   = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant METADATA_ROLE     = keccak256("METADATA_ROLE");
    bytes32 public constant NFT_ADMIN         = keccak256("NFT_ADMIN");

    Counters.Counter private _tokenIdCounter;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum SealStatus {
        ACTIVE,      // Valid notary seal
        SUSPENDED,   // Temporarily suspended
        REVOKED,     // Permanently revoked
        EXPIRED      // Past document expiry
    }

    enum DocumentType {
        DEED,
        CONTRACT,
        WILL,
        POWER_OF_ATTORNEY,
        AFFIDAVIT,
        CERTIFICATE,
        PATENT,
        OTHER
    }

    // ─────────────────────────────────────────────────────────────────────────
    // On-Chain Metadata Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct NotarySeal {
        bytes32       documentHash;         // SHA-256 hash of notarized document
        bytes32       metadataHash;         // Hash of extended off-chain metadata JSON
        address       notary;               // Notary who issued the seal
        address       originalOwner;        // First owner (document submitter)
        uint256       mintedAt;             // Block timestamp of minting
        uint256       documentDate;         // Date on the document (may differ from mint)
        uint256       expiryDate;           // 0 = perpetual
        uint256       registryDocumentId;   // Linked DocumentRegistry ID
        string        jurisdiction;         // ISO 3166-1 country code
        string        ipfsCID;             // IPFS CID of the document
        DocumentType  docType;
        SealStatus    status;
        bool          aiValidated;          // AI validation certificate issued
        bool          multiPartySign;       // Requires multiple signatories
        uint256       requiredSignatures;   // For multi-party documents
        uint256       collectedSignatures;  // Current signature count
        uint256       confidenceScore;      // AI confidence (0-10000 basis points)
    }

    struct Signatory {
        address  signer;
        uint256  signedAt;
        bytes32  signatureHash;  // Hash of their EIP-712 signature
        bool     hasSigned;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    mapping(uint256 => NotarySeal)                public seals;
    mapping(uint256 => Signatory[])               public signatories;
    mapping(uint256 => mapping(address => bool))  public hasSignedToken;

    // Transfer restrictions
    mapping(uint256 => bool)    public transferLocked;    // True = non-transferable seal
    mapping(address => bool)    public blockedAddresses;  // Compliance blocklist

    // Document hash => tokenId (for lookup)
    mapping(bytes32 => uint256) public documentHashToTokenId;

    // Stats
    uint256 public totalMinted;
    uint256 public totalRevoked;
    uint256 public totalExpired;

    // ERC-2981 Royalty config
    uint96  public defaultRoyaltyBP;   // Default royalty in basis points (e.g. 500 = 5%)
    address public royaltyReceiver;    // Default royalty recipient

    // EIP-712 typehash for signature approval
    bytes32 public constant SIGN_TYPEHASH = keccak256(
        "SignDocument(uint256 tokenId,bytes32 documentHash,address signer,uint256 nonce)"
    );
    mapping(address => uint256) public signerNonces;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event NotarySealMinted(
        uint256 indexed tokenId,
        bytes32 indexed documentHash,
        address indexed notary,
        address owner,
        DocumentType docType,
        string  jurisdiction,
        uint256 timestamp
    );

    event SealStatusChanged(
        uint256 indexed tokenId,
        SealStatus oldStatus,
        SealStatus newStatus,
        address changedBy,
        uint256 timestamp
    );

    event SealAIAttestation(
        uint256 indexed tokenId,
        bool    aiValidated,
        uint256 confidenceScore,
        uint256 timestamp
    );

    event DocumentSigned(
        uint256 indexed tokenId,
        address indexed signer,
        uint256 signatureCount,
        uint256 requiredSignatures,
        uint256 timestamp
    );

    event AllSignaturesCollected(uint256 indexed tokenId, uint256 timestamp);

    event MetadataUpdated(
        uint256 indexed tokenId,
        bytes32 newMetadataHash,
        string  newIpfsCID,
        address updatedBy,
        uint256 timestamp
    );

    event TransferLockSet(uint256 indexed tokenId, bool locked, address setBy);

    event RoyaltySet(
        uint256 indexed tokenId,
        address indexed receiver,
        uint96  feeBasisPoints
    );

    event DefaultRoyaltyUpdated(address indexed receiver, uint96 feeBasisPoints);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin)
        ERC721("NotaryNFT", "NOTARY")
        EIP712("NotaryNFT", "2.0")
    {
        require(admin != address(0), "NotaryNFT: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(NFT_ADMIN,          admin);
        _grantRole(NOTARY_ROLE,        admin);
        _grantRole(MINTER_ROLE,        admin);
        _grantRole(COMPLIANCE_ROLE,    admin);
        _grantRole(METADATA_ROLE,      admin);

        // Default royalty: 5% to admin
        defaultRoyaltyBP = 500;
        royaltyReceiver  = admin;
        _setDefaultRoyalty(admin, 500);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Minting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new NotaryNFT seal for a validated document
     * @param recipient           Token recipient (document owner)
     * @param documentHash        SHA-256 hash of document
     * @param metadataHash        Hash of extended metadata
     * @param ipfsCID             IPFS CID for document
     * @param jurisdiction        ISO 3166-1 court jurisdiction
     * @param docType             Document classification
     * @param documentDate        Date stated on document
     * @param expiryDate          Document expiry (0 = perpetual)
     * @param registryDocumentId  Linked DocumentRegistry ID
     * @param aiConfidenceScore   AI validation confidence (0-10000)
     * @param requiredSignatures  Additional signatories required (0 = none)
     * @param tokenURI_           Metadata URI (IPFS or HTTPS)
     * @return tokenId            Minted token ID
     */
    function mintNotarySeal(
        address      recipient,
        bytes32      documentHash,
        bytes32      metadataHash,
        string calldata ipfsCID,
        string calldata jurisdiction,
        DocumentType docType,
        uint256      documentDate,
        uint256      expiryDate,
        uint256      registryDocumentId,
        uint256      aiConfidenceScore,
        uint256      requiredSignatures,
        string calldata tokenURI_
    )
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 tokenId)
    {
        // Note: royalty defaults to global default; call setTokenRoyalty after mint for custom rates
        require(recipient != address(0),                   "NotaryNFT: invalid recipient");
        require(documentHash != bytes32(0),                "NotaryNFT: null document hash");
        require(documentHashToTokenId[documentHash] == 0,  "NotaryNFT: document already notarized");
        require(!blockedAddresses[recipient],              "NotaryNFT: recipient blocked");
        require(aiConfidenceScore <= 10000,                "NotaryNFT: invalid confidence score");
        require(expiryDate == 0 || expiryDate > block.timestamp, "NotaryNFT: invalid expiry");

        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        seals[tokenId] = NotarySeal({
            documentHash:        documentHash,
            metadataHash:        metadataHash,
            notary:              msg.sender,
            originalOwner:       recipient,
            mintedAt:            block.timestamp,
            documentDate:        documentDate,
            expiryDate:          expiryDate,
            registryDocumentId:  registryDocumentId,
            jurisdiction:        jurisdiction,
            ipfsCID:             ipfsCID,
            docType:             docType,
            status:              SealStatus.ACTIVE,
            aiValidated:         aiConfidenceScore >= 7000, // 70% threshold
            multiPartySign:      requiredSignatures > 0,
            requiredSignatures:  requiredSignatures,
            collectedSignatures: 0,
            confidenceScore:     aiConfidenceScore
        });

        documentHashToTokenId[documentHash] = tokenId;
        totalMinted++;

        emit NotarySealMinted(
            tokenId,
            documentHash,
            msg.sender,
            recipient,
            docType,
            jurisdiction,
            block.timestamp
        );

        emit SealAIAttestation(tokenId, aiConfidenceScore >= 7000, aiConfidenceScore, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Multi-Party Signing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Sign a multi-party document using EIP-712 structured signature
     * @param tokenId   Token to sign
     * @param signature EIP-712 signature bytes
     */
    function signDocument(uint256 tokenId, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
    {
        NotarySeal storage seal = seals[tokenId];
        require(seal.mintedAt > 0,         "NotaryNFT: token does not exist");
        require(seal.multiPartySign,        "NotaryNFT: not a multi-party document");
        require(seal.status == SealStatus.ACTIVE, "NotaryNFT: seal not active");
        require(!hasSignedToken[tokenId][msg.sender], "NotaryNFT: already signed");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            SIGN_TYPEHASH,
            tokenId,
            seal.documentHash,
            msg.sender,
            signerNonces[msg.sender]
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        address recovered = hash.recover(signature);
        require(recovered == msg.sender, "NotaryNFT: invalid signature");

        signerNonces[msg.sender]++;
        hasSignedToken[tokenId][msg.sender] = true;
        seal.collectedSignatures++;

        bytes32 sigHash = keccak256(signature);
        signatories[tokenId].push(Signatory({
            signer:        msg.sender,
            signedAt:      block.timestamp,
            signatureHash: sigHash,
            hasSigned:     true
        }));

        emit DocumentSigned(
            tokenId,
            msg.sender,
            seal.collectedSignatures,
            seal.requiredSignatures,
            block.timestamp
        );

        if (seal.collectedSignatures >= seal.requiredSignatures) {
            emit AllSignaturesCollected(tokenId, block.timestamp);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Metadata Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update extended metadata for a seal (METADATA_ROLE only)
     */
    function updateMetadata(
        uint256 tokenId,
        bytes32 newMetadataHash,
        string calldata newIpfsCID,
        string calldata newTokenURI
    )
        external
        onlyRole(METADATA_ROLE)
        whenNotPaused
    {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        seals[tokenId].metadataHash = newMetadataHash;
        seals[tokenId].ipfsCID      = newIpfsCID;
        _setTokenURI(tokenId, newTokenURI);
        emit MetadataUpdated(tokenId, newMetadataHash, newIpfsCID, msg.sender, block.timestamp);
    }

    /**
     * @notice Attach AI validation attestation post-mint
     */
    function attestAIValidation(uint256 tokenId, uint256 confidenceScore)
        external
        onlyRole(NOTARY_ROLE)
    {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        require(confidenceScore <= 10000,    "NotaryNFT: invalid score");
        seals[tokenId].aiValidated      = confidenceScore >= 7000;
        seals[tokenId].confidenceScore  = confidenceScore;
        emit SealAIAttestation(tokenId, confidenceScore >= 7000, confidenceScore, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Compliance & Status Management
    // ─────────────────────────────────────────────────────────────────────────

    function suspendSeal(uint256 tokenId) external onlyRole(COMPLIANCE_ROLE) {
        _changeSealStatus(tokenId, SealStatus.SUSPENDED);
    }

    function reactivateSeal(uint256 tokenId) external onlyRole(COMPLIANCE_ROLE) {
        _changeSealStatus(tokenId, SealStatus.ACTIVE);
    }

    function revokeSeal(uint256 tokenId) external onlyRole(COMPLIANCE_ROLE) {
        _changeSealStatus(tokenId, SealStatus.REVOKED);
        totalRevoked++;
    }

    function setTransferLock(uint256 tokenId, bool locked) external onlyRole(COMPLIANCE_ROLE) {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        transferLocked[tokenId] = locked;
        emit TransferLockSet(tokenId, locked, msg.sender);
    }

    function blockAddress(address account) external onlyRole(COMPLIANCE_ROLE) {
        blockedAddresses[account] = true;
    }

    function unblockAddress(address account) external onlyRole(COMPLIANCE_ROLE) {
        blockedAddresses[account] = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getSeal(uint256 tokenId) external view returns (NotarySeal memory) {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        return seals[tokenId];
    }

    function getSignatories(uint256 tokenId) external view returns (Signatory[] memory) {
        return signatories[tokenId];
    }

    function isSealValid(uint256 tokenId) external view returns (bool) {
        NotarySeal storage seal = seals[tokenId];
        if (seal.mintedAt == 0)              return false;
        if (seal.status != SealStatus.ACTIVE) return false;
        if (seal.expiryDate != 0 && block.timestamp > seal.expiryDate) return false;
        return true;
    }

    function isFullySigned(uint256 tokenId) external view returns (bool) {
        NotarySeal storage seal = seals[tokenId];
        if (!seal.multiPartySign) return true;
        return seal.collectedSignatures >= seal.requiredSignatures;
    }

    function getSigningDomain() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function totalTokens() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transfer Overrides
    // ─────────────────────────────────────────────────────────────────────────

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    )
        internal
        override(ERC721, ERC721Enumerable)
        whenNotPaused
    {
        // Minting is always allowed (from == address(0))
        if (from != address(0)) {
            require(!transferLocked[tokenId],       "NotaryNFT: transfer locked");
            require(!blockedAddresses[from],        "NotaryNFT: sender blocked");
            require(!blockedAddresses[to],          "NotaryNFT: recipient blocked");
            NotarySeal storage seal = seals[tokenId];
            require(seal.status == SealStatus.ACTIVE, "NotaryNFT: seal not active");
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Royalty Management (ERC-2981)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Set a custom royalty for a specific token.
     *         Overrides the default royalty for this tokenId only.
     * @param tokenId   Token to configure
     * @param receiver  Royalty recipient address
     * @param feeBP     Fee in basis points (max 1000 = 10%)
     */
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96  feeBP
    )
        external
        onlyRole(NFT_ADMIN)
    {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        require(receiver != address(0),       "NotaryNFT: invalid receiver");
        require(feeBP <= 1000,                "NotaryNFT: royalty too high"); // max 10%
        _setTokenRoyalty(tokenId, receiver, feeBP);
        emit RoyaltySet(tokenId, receiver, feeBP);
    }

    /**
     * @notice Update the default royalty applied to all tokens without a custom rate.
     * @param receiver  Default royalty recipient
     * @param feeBP     Fee in basis points (max 1000 = 10%)
     */
    function setDefaultRoyalty(
        address receiver,
        uint96  feeBP
    )
        external
        onlyRole(NFT_ADMIN)
    {
        require(receiver != address(0), "NotaryNFT: invalid receiver");
        require(feeBP <= 1000,          "NotaryNFT: royalty too high");
        defaultRoyaltyBP = feeBP;
        royaltyReceiver  = receiver;
        _setDefaultRoyalty(receiver, feeBP);
        emit DefaultRoyaltyUpdated(receiver, feeBP);
    }

    /**
     * @notice Reset a token's custom royalty back to the default.
     */
    function resetTokenRoyalty(uint256 tokenId) external onlyRole(NFT_ADMIN) {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        _resetTokenRoyalty(tokenId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(NFT_ADMIN) { _pause(); }
    function unpause() external onlyRole(NFT_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Required Overrides
    // ─────────────────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _changeSealStatus(uint256 tokenId, SealStatus newStatus) internal {
        require(seals[tokenId].mintedAt > 0, "NotaryNFT: token does not exist");
        SealStatus oldStatus = seals[tokenId].status;
        seals[tokenId].status = newStatus;
        emit SealStatusChanged(tokenId, oldStatus, newStatus, msg.sender, block.timestamp);
    }
}
