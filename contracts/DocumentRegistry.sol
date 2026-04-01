// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    DocumentRegistry.sol
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
 * @title DocumentRegistry
 * @author AI Autonomous Notary Protocol
 * @notice Immutable on-chain registry for all notarized documents.
 *         Provides full provenance tracking, versioning, ownership transfer,
 *         and audit trail for the Document Securities Market ecosystem.
 * @dev All document records are permanent and tamper-proof. Versions are
 *      append-only linked lists. Emits rich events for off-chain indexing.
 */
contract DocumentRegistry is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant NOTARY_ROLE       = keccak256("NOTARY_ROLE");
    bytes32 public constant AUDITOR_ROLE      = keccak256("AUDITOR_ROLE");
    bytes32 public constant REGISTRY_ADMIN    = keccak256("REGISTRY_ADMIN");
    bytes32 public constant VALIDATOR_ROLE    = keccak256("VALIDATOR_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum DocumentStatus {
        PENDING,       // Submitted, awaiting AI validation
        VALIDATED,     // AI-validated, awaiting notarization
        NOTARIZED,     // Fully notarized on-chain
        REVOKED,       // Revoked by compliance or court order
        EXPIRED,       // Past document expiry
        DISPUTED       // Under legal dispute
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

    struct DocumentRecord {
        bytes32   documentHash;      // SHA-256 hash of the document
        bytes32   metadataHash;      // Hash of off-chain metadata (IPFS CID)
        address   owner;             // Current legal owner
        address   issuer;            // Original issuing notary
        uint256   registrationDate;  // Unix timestamp
        uint256   expiryDate;        // 0 = no expiry
        uint256   tokenId;           // Associated NotaryNFT token ID (0 = none)
        uint256   versionCount;      // Total number of versions
        DocumentStatus status;
        DocumentType   docType;
        string    jurisdiction;      // ISO 3166-1 country code
        string    ipfsCID;           // IPFS content identifier for document
        bool      isSecuritized;     // Has been tokenized as a security
    }

    struct DocumentVersion {
        bytes32 documentHash;
        bytes32 metadataHash;
        address updatedBy;
        uint256 timestamp;
        string  changeReason;
        string  ipfsCID;
    }

    struct AuditEntry {
        address actor;
        uint256 timestamp;
        string  action;
        bytes32 dataHash;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────
    Counters.Counter private _documentIdCounter;

    // documentId => DocumentRecord
    mapping(uint256 => DocumentRecord) public documents;

    // documentHash => documentId (prevents duplicate registration)
    mapping(bytes32 => uint256) public hashToDocumentId;

    // documentId => version index => DocumentVersion
    mapping(uint256 => mapping(uint256 => DocumentVersion)) public documentVersions;

    // documentId => AuditEntry[]
    mapping(uint256 => AuditEntry[]) private _auditTrail;

    // owner => documentId[]
    mapping(address => uint256[]) private _ownerDocuments;

    // documentId => provenance chain (previous owners in order)
    mapping(uint256 => address[]) private _provenanceChain;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────
    event DocumentRegistered(
        uint256 indexed documentId,
        bytes32 indexed documentHash,
        address indexed owner,
        string  jurisdiction,
        DocumentType docType,
        uint256 timestamp
    );

    event DocumentValidated(
        uint256 indexed documentId,
        address indexed validator,
        uint256 timestamp
    );

    event DocumentNotarized(
        uint256 indexed documentId,
        address indexed notary,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    event DocumentStatusChanged(
        uint256 indexed documentId,
        DocumentStatus indexed oldStatus,
        DocumentStatus indexed newStatus,
        address actor,
        uint256 timestamp
    );

    event DocumentOwnershipTransferred(
        uint256 indexed documentId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    event DocumentVersionAdded(
        uint256 indexed documentId,
        uint256 indexed versionIndex,
        bytes32 newHash,
        address updatedBy,
        uint256 timestamp
    );

    event DocumentSecuritized(
        uint256 indexed documentId,
        address indexed securityToken,
        uint256 timestamp
    );

    event AuditEntryCreated(
        uint256 indexed documentId,
        address indexed actor,
        string  action,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────
    modifier onlyDocumentOwner(uint256 documentId) {
        require(documents[documentId].owner == msg.sender, "DocumentRegistry: not document owner");
        _;
    }

    modifier documentExists(uint256 documentId) {
        require(documents[documentId].registrationDate != 0, "DocumentRegistry: document does not exist");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(address admin) {
        require(admin != address(0), "DocumentRegistry: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ADMIN,    admin);
        _grantRole(NOTARY_ROLE,       admin);
        _grantRole(AUDITOR_ROLE,      admin);
        _grantRole(VALIDATOR_ROLE,    admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new document in the registry
     * @param documentHash  SHA-256 hash of the document content
     * @param metadataHash  Hash of off-chain metadata JSON
     * @param ipfsCID       IPFS CID pointing to encrypted document
     * @param docType       Document classification
     * @param jurisdiction  ISO 3166-1 country code (e.g., "US", "EU")
     * @param expiryDate    Unix timestamp for expiry; 0 for perpetual
     * @return documentId   Unique registry identifier
     */
    function registerDocument(
        bytes32      documentHash,
        bytes32      metadataHash,
        string calldata ipfsCID,
        DocumentType docType,
        string calldata jurisdiction,
        uint256      expiryDate
    )
        external
        whenNotPaused
        nonReentrant
        returns (uint256 documentId)
    {
        require(documentHash != bytes32(0),                  "DocumentRegistry: null document hash");
        require(hashToDocumentId[documentHash] == 0,         "DocumentRegistry: document already registered");
        require(bytes(ipfsCID).length > 0,                   "DocumentRegistry: IPFS CID required");
        require(bytes(jurisdiction).length > 0,              "DocumentRegistry: jurisdiction required");
        require(expiryDate == 0 || expiryDate > block.timestamp, "DocumentRegistry: invalid expiry");

        _documentIdCounter.increment();
        documentId = _documentIdCounter.current();

        documents[documentId] = DocumentRecord({
            documentHash:    documentHash,
            metadataHash:    metadataHash,
            owner:           msg.sender,
            issuer:          address(0),
            registrationDate: block.timestamp,
            expiryDate:      expiryDate,
            tokenId:         0,
            versionCount:    1,
            status:          DocumentStatus.PENDING,
            docType:         docType,
            jurisdiction:    jurisdiction,
            ipfsCID:         ipfsCID,
            isSecuritized:   false
        });

        hashToDocumentId[documentHash] = documentId;
        _ownerDocuments[msg.sender].push(documentId);
        _provenanceChain[documentId].push(msg.sender);

        // Store initial version
        documentVersions[documentId][0] = DocumentVersion({
            documentHash: documentHash,
            metadataHash: metadataHash,
            updatedBy:    msg.sender,
            timestamp:    block.timestamp,
            changeReason: "Initial registration",
            ipfsCID:      ipfsCID
        });

        _recordAudit(documentId, "REGISTERED", documentHash);

        emit DocumentRegistered(
            documentId,
            documentHash,
            msg.sender,
            jurisdiction,
            docType,
            block.timestamp
        );
    }

    /**
     * @notice Mark a document as AI-validated
     * @param documentId The registry document ID
     */
    function validateDocument(uint256 documentId)
        external
        onlyRole(VALIDATOR_ROLE)
        documentExists(documentId)
        whenNotPaused
    {
        DocumentRecord storage doc = documents[documentId];
        require(doc.status == DocumentStatus.PENDING, "DocumentRegistry: must be PENDING");

        DocumentStatus oldStatus = doc.status;
        doc.status = DocumentStatus.VALIDATED;

        _recordAudit(documentId, "VALIDATED", doc.documentHash);

        emit DocumentStatusChanged(documentId, oldStatus, DocumentStatus.VALIDATED, msg.sender, block.timestamp);
        emit DocumentValidated(documentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Notarize a validated document and link it to an NFT
     * @param documentId The registry document ID
     * @param tokenId    The NotaryNFT token ID
     */
    function notarizeDocument(uint256 documentId, uint256 tokenId)
        external
        onlyRole(NOTARY_ROLE)
        documentExists(documentId)
        whenNotPaused
    {
        DocumentRecord storage doc = documents[documentId];
        require(doc.status == DocumentStatus.VALIDATED, "DocumentRegistry: must be VALIDATED");

        DocumentStatus oldStatus = doc.status;
        doc.status  = DocumentStatus.NOTARIZED;
        doc.issuer  = msg.sender;
        doc.tokenId = tokenId;

        _recordAudit(documentId, "NOTARIZED", doc.documentHash);

        emit DocumentStatusChanged(documentId, oldStatus, DocumentStatus.NOTARIZED, msg.sender, block.timestamp);
        emit DocumentNotarized(documentId, msg.sender, tokenId, block.timestamp);
    }

    /**
     * @notice Add a new version to an existing document (owner or notary)
     * @param documentId   Registry document ID
     * @param newHash      SHA-256 hash of the updated document
     * @param newMetaHash  Hash of updated metadata
     * @param newCID       New IPFS CID
     * @param reason       Human-readable reason for update
     */
    function addDocumentVersion(
        uint256 documentId,
        bytes32 newHash,
        bytes32 newMetaHash,
        string calldata newCID,
        string calldata reason
    )
        external
        documentExists(documentId)
        whenNotPaused
        nonReentrant
    {
        DocumentRecord storage doc = documents[documentId];
        require(
            doc.owner == msg.sender || hasRole(NOTARY_ROLE, msg.sender),
            "DocumentRegistry: unauthorized"
        );
        require(doc.status != DocumentStatus.REVOKED, "DocumentRegistry: document revoked");
        require(newHash != bytes32(0), "DocumentRegistry: null hash");
        require(hashToDocumentId[newHash] == 0, "DocumentRegistry: hash already exists");
        require(bytes(reason).length > 0, "DocumentRegistry: reason required");

        uint256 versionIndex = doc.versionCount;
        documentVersions[documentId][versionIndex] = DocumentVersion({
            documentHash: newHash,
            metadataHash: newMetaHash,
            updatedBy:    msg.sender,
            timestamp:    block.timestamp,
            changeReason: reason,
            ipfsCID:      newCID
        });

        // Update primary record to latest version
        doc.documentHash = newHash;
        doc.metadataHash = newMetaHash;
        doc.ipfsCID      = newCID;
        doc.versionCount++;

        hashToDocumentId[newHash] = documentId;
        _recordAudit(documentId, "VERSION_ADDED", newHash);

        emit DocumentVersionAdded(documentId, versionIndex, newHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer document ownership on-chain
     * @param documentId Registry document ID
     * @param newOwner   New owner address
     */
    function transferDocumentOwnership(uint256 documentId, address newOwner)
        external
        onlyDocumentOwner(documentId)
        documentExists(documentId)
        whenNotPaused
        nonReentrant
    {
        require(newOwner != address(0),           "DocumentRegistry: invalid new owner");
        require(newOwner != msg.sender,           "DocumentRegistry: same owner");
        DocumentRecord storage doc = documents[documentId];
        require(doc.status == DocumentStatus.NOTARIZED, "DocumentRegistry: must be notarized");

        address previousOwner = doc.owner;
        doc.owner = newOwner;

        _ownerDocuments[newOwner].push(documentId);
        _provenanceChain[documentId].push(newOwner);
        _recordAudit(documentId, "OWNERSHIP_TRANSFERRED", bytes32(uint256(uint160(newOwner))));

        emit DocumentOwnershipTransferred(documentId, previousOwner, newOwner, block.timestamp);
    }

    /**
     * @notice Revoke a document (compliance or admin only)
     */
    function revokeDocument(uint256 documentId, string calldata reason)
        external
        onlyRole(REGISTRY_ADMIN)
        documentExists(documentId)
    {
        DocumentRecord storage doc = documents[documentId];
        require(doc.status != DocumentStatus.REVOKED, "DocumentRegistry: already revoked");

        DocumentStatus oldStatus = doc.status;
        doc.status = DocumentStatus.REVOKED;

        _recordAudit(documentId, "REVOKED", keccak256(bytes(reason)));
        emit DocumentStatusChanged(documentId, oldStatus, DocumentStatus.REVOKED, msg.sender, block.timestamp);
    }

    /**
     * @notice Mark a document as securitized (linked to a security token)
     */
    function markSecuritized(uint256 documentId, address securityToken)
        external
        onlyRole(REGISTRY_ADMIN)
        documentExists(documentId)
    {
        require(!documents[documentId].isSecuritized, "DocumentRegistry: already securitized");
        require(documents[documentId].status == DocumentStatus.NOTARIZED, "DocumentRegistry: must be notarized");
        documents[documentId].isSecuritized = true;
        _recordAudit(documentId, "SECURITIZED", bytes32(uint256(uint160(securityToken))));
        emit DocumentSecuritized(documentId, securityToken, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getDocument(uint256 documentId)
        external
        view
        documentExists(documentId)
        returns (DocumentRecord memory)
    {
        return documents[documentId];
    }

    function getDocumentVersion(uint256 documentId, uint256 versionIndex)
        external
        view
        documentExists(documentId)
        returns (DocumentVersion memory)
    {
        require(versionIndex < documents[documentId].versionCount, "DocumentRegistry: invalid version");
        return documentVersions[documentId][versionIndex];
    }

    function getOwnerDocuments(address owner) external view returns (uint256[] memory) {
        return _ownerDocuments[owner];
    }

    function getProvenanceChain(uint256 documentId)
        external
        view
        documentExists(documentId)
        returns (address[] memory)
    {
        return _provenanceChain[documentId];
    }

    function getAuditTrail(uint256 documentId)
        external
        view
        onlyRole(AUDITOR_ROLE)
        documentExists(documentId)
        returns (AuditEntry[] memory)
    {
        return _auditTrail[documentId];
    }

    function totalDocuments() external view returns (uint256) {
        return _documentIdCounter.current();
    }

    function isDocumentValid(uint256 documentId) external view returns (bool) {
        DocumentRecord storage doc = documents[documentId];
        if (doc.registrationDate == 0) return false;
        if (doc.status == DocumentStatus.REVOKED) return false;
        if (doc.expiryDate != 0 && block.timestamp > doc.expiryDate) return false;
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────

    function pause() external onlyRole(REGISTRY_ADMIN) { _pause(); }
    function unpause() external onlyRole(REGISTRY_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _recordAudit(uint256 documentId, string memory action, bytes32 dataHash) internal {
        _auditTrail[documentId].push(AuditEntry({
            actor:     msg.sender,
            timestamp: block.timestamp,
            action:    action,
            dataHash:  dataHash
        }));
        emit AuditEntryCreated(documentId, msg.sender, action, block.timestamp);
    }
}
