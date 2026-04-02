// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    GDPRManager.sol
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
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title GDPRManager
 * @author AI Autonomous Notary Protocol
 * @notice On-chain coordination layer for GDPR compliance obligations.
 *
 * @dev Key principle: On-chain document hashes are IMMUTABLE and cannot be
 *      erased (blockchain properties). GDPR erasure targets:
 *        1. IPFS content (pins are removed from Pinata by off-chain service)
 *        2. Database records (PostgreSQL rows deleted by off-chain service)
 *        3. Evidence bundles (file exports purged)
 *
 *      This contract tracks:
 *        - Data subject consent records (GDPR Art. 6-7)
 *        - Erasure requests and their fulfilment status (Art. 17)
 *        - Data residency constraints per document (Art. 46)
 *        - Retention policy expiry per document (Art. 5(1)(e))
 *
 *      Off-chain services listen to emitted events and perform the actual
 *      data deletion, then confirm back via `markErased`.
 */
contract GDPRManager is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant GDPR_ADMIN       = keccak256("GDPR_ADMIN");
    bytes32 public constant DATA_PROCESSOR   = keccak256("DATA_PROCESSOR");
    bytes32 public constant DPO_ROLE         = keccak256("DPO_ROLE"); // Data Protection Officer

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum LegalBasis {
        CONSENT,           // Art. 6(1)(a)
        CONTRACT,          // Art. 6(1)(b)
        LEGAL_OBLIGATION,  // Art. 6(1)(c)
        VITAL_INTERESTS,   // Art. 6(1)(d)
        PUBLIC_TASK,       // Art. 6(1)(e)
        LEGITIMATE_INTEREST // Art. 6(1)(f)
    }

    enum ErasureStatus {
        PENDING,           // Request received, not yet processed
        IN_PROGRESS,       // Off-chain deletion underway
        COMPLETE,          // All eligible data deleted
        REJECTED,          // Cannot erase due to legal obligation (e.g. retention law)
        PARTIAL            // Some data erased; remainder legally retained
    }

    enum DataResidency {
        ANY,               // No restriction
        EU_EEA,            // GDPR jurisdiction only
        US,
        UK,
        SPECIFIED          // Custom list stored off-chain
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct ConsentRecord {
        address  dataSubject;
        bytes32  documentHash;     // Linked document (0 = general consent)
        LegalBasis legalBasis;
        string   purposeHash;      // IPFS CID of purpose description (not PII)
        uint256  grantedAt;
        uint256  expiresAt;        // 0 = until withdrawn
        bool     withdrawn;
        uint256  withdrawnAt;
    }

    struct ErasureRequest {
        uint256       requestId;
        address       dataSubject;
        bytes32       documentHash;    // 0 = all documents for this subject
        ErasureStatus status;
        string        requestReason;
        uint256       requestedAt;
        uint256       resolvedAt;
        string        rejectionReason; // Set if status == REJECTED
        address       processor;       // Who processed this request
    }

    struct RetentionPolicy {
        bytes32  documentHash;
        uint256  retainUntil;           // Absolute expiry timestamp
        bool     legalHoldActive;       // Legal hold overrides erasure requests
        string   legalHoldReason;
        DataResidency residency;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _requestIdCounter;
    Counters.Counter private _consentIdCounter;

    mapping(uint256 => ConsentRecord)     public consentRecords;  // consentId → record
    mapping(uint256 => ErasureRequest)    public erasureRequests; // requestId → request
    mapping(bytes32 => RetentionPolicy)   public retentionPolicies; // documentHash → policy

    // dataSubject → consent IDs
    mapping(address => uint256[]) public subjectConsents;
    // dataSubject → erasure request IDs
    mapping(address => uint256[]) public subjectErasureRequests;
    // documentHash → erasure request IDs
    mapping(bytes32 => uint256[]) public documentErasureRequests;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ConsentGranted(
        uint256 indexed consentId,
        address indexed dataSubject,
        bytes32 indexed documentHash,
        LegalBasis legalBasis
    );

    event ConsentWithdrawn(
        uint256 indexed consentId,
        address indexed dataSubject
    );

    event ErasureRequested(
        uint256 indexed requestId,
        address indexed dataSubject,
        bytes32 indexed documentHash
    );

    event ErasureProcessed(
        uint256 indexed requestId,
        ErasureStatus status,
        string reason
    );

    event RetentionPolicySet(
        bytes32 indexed documentHash,
        uint256 retainUntil,
        DataResidency residency
    );

    event LegalHoldApplied(bytes32 indexed documentHash, string reason);
    event LegalHoldReleased(bytes32 indexed documentHash);

    event DataExpired(bytes32 indexed documentHash, uint256 retainUntil);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address dpo) {
        require(admin != address(0), "GDPRManager: zero admin");
        require(dpo   != address(0), "GDPRManager: zero DPO");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GDPR_ADMIN,         admin);
        _grantRole(DPO_ROLE,           dpo);
        _grantRole(DATA_PROCESSOR,     admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Consent Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record data subject consent for processing.
     * @param documentHash  Linked document (bytes32(0) = general consent)
     * @param legalBasis    Legal basis under GDPR Art. 6
     * @param purposeHash   IPFS CID of processing purpose description
     * @param ttl           Consent validity period (0 = indefinite)
     */
    function grantConsent(
        bytes32    documentHash,
        LegalBasis legalBasis,
        string calldata purposeHash,
        uint256    ttl
    ) external returns (uint256 consentId) {
        _consentIdCounter.increment();
        consentId = _consentIdCounter.current();

        consentRecords[consentId] = ConsentRecord({
            dataSubject:  msg.sender,
            documentHash: documentHash,
            legalBasis:   legalBasis,
            purposeHash:  purposeHash,
            grantedAt:    block.timestamp,
            expiresAt:    ttl > 0 ? block.timestamp + ttl : 0,
            withdrawn:    false,
            withdrawnAt:  0
        });

        subjectConsents[msg.sender].push(consentId);

        emit ConsentGranted(consentId, msg.sender, documentHash, legalBasis);
    }

    /**
     * @notice Withdraw previously granted consent (GDPR Art. 7(3)).
     *         Triggers off-chain review of whether processing must cease.
     */
    function withdrawConsent(uint256 consentId) external {
        ConsentRecord storage c = consentRecords[consentId];
        require(c.dataSubject == msg.sender, "GDPRManager: not data subject");
        require(!c.withdrawn,                "GDPRManager: already withdrawn");
        c.withdrawn   = true;
        c.withdrawnAt = block.timestamp;
        emit ConsentWithdrawn(consentId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Erasure (Right to be Forgotten — GDPR Art. 17)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Submit an erasure request for a specific document or all documents.
     * @param documentHash  Specific document to erase (bytes32(0) = all)
     * @param reason        Reason for erasure request
     */
    function requestErasure(
        bytes32 documentHash,
        string calldata reason
    ) external returns (uint256 requestId) {
        _requestIdCounter.increment();
        requestId = _requestIdCounter.current();

        erasureRequests[requestId] = ErasureRequest({
            requestId:       requestId,
            dataSubject:     msg.sender,
            documentHash:    documentHash,
            status:          ErasureStatus.PENDING,
            requestReason:   reason,
            requestedAt:     block.timestamp,
            resolvedAt:      0,
            rejectionReason: "",
            processor:       address(0)
        });

        subjectErasureRequests[msg.sender].push(requestId);
        if (documentHash != bytes32(0)) {
            documentErasureRequests[documentHash].push(requestId);
        }

        emit ErasureRequested(requestId, msg.sender, documentHash);
    }

    /**
     * @notice Data processor confirms erasure completion (or rejection).
     *         Off-chain service calls this after deleting IPFS pins and DB records.
     * @param requestId  Erasure request being resolved
     * @param status     COMPLETE, REJECTED, or PARTIAL
     * @param reason     Explanation (required if REJECTED or PARTIAL)
     */
    function markErased(
        uint256       requestId,
        ErasureStatus status,
        string calldata reason
    ) external onlyRole(DATA_PROCESSOR) {
        ErasureRequest storage r = erasureRequests[requestId];
        require(r.requestId != 0,                     "GDPRManager: not found");
        require(r.status == ErasureStatus.PENDING ||
                r.status == ErasureStatus.IN_PROGRESS,"GDPRManager: already resolved");

        // Cannot erase if legal hold is active
        if (r.documentHash != bytes32(0)) {
            RetentionPolicy storage pol = retentionPolicies[r.documentHash];
            if (pol.legalHoldActive) {
                status = ErasureStatus.REJECTED;
            }
        }

        r.status          = status;
        r.resolvedAt      = block.timestamp;
        r.rejectionReason = reason;
        r.processor       = msg.sender;

        emit ErasureProcessed(requestId, status, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Retention Policies
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Set retention policy for a document.
     *         Mirrors the overlay policy `retentionPolicy.years` field.
     * @param documentHash Hash of the document
     * @param retainUntil  Absolute expiry (from GDPR Art. 5(1)(e))
     * @param residency    Data residency constraint
     */
    function setRetentionPolicy(
        bytes32      documentHash,
        uint256      retainUntil,
        DataResidency residency
    ) external onlyRole(DATA_PROCESSOR) {
        require(documentHash != bytes32(0), "GDPRManager: zero hash");
        require(retainUntil > block.timestamp, "GDPRManager: expiry in past");

        retentionPolicies[documentHash] = RetentionPolicy({
            documentHash:    documentHash,
            retainUntil:     retainUntil,
            legalHoldActive: retentionPolicies[documentHash].legalHoldActive,
            legalHoldReason: retentionPolicies[documentHash].legalHoldReason,
            residency:       residency
        });

        emit RetentionPolicySet(documentHash, retainUntil, residency);
    }

    /**
     * @notice Apply a legal hold to a document (overrides erasure requests).
     *         Used when document is subject to litigation or regulatory inquiry.
     */
    function applyLegalHold(bytes32 documentHash, string calldata reason)
        external onlyRole(DPO_ROLE)
    {
        require(documentHash != bytes32(0), "GDPRManager: zero hash");
        retentionPolicies[documentHash].legalHoldActive = true;
        retentionPolicies[documentHash].legalHoldReason = reason;
        emit LegalHoldApplied(documentHash, reason);
    }

    /**
     * @notice Release a legal hold. Pending erasure requests become processable.
     */
    function releaseLegalHold(bytes32 documentHash) external onlyRole(DPO_ROLE) {
        retentionPolicies[documentHash].legalHoldActive = false;
        retentionPolicies[documentHash].legalHoldReason = "";
        emit LegalHoldReleased(documentHash);
    }

    /**
     * @notice Signal that a document's retention period has expired.
     *         Off-chain service should delete IPFS pins and DB records.
     */
    function signalExpiry(bytes32 documentHash) external onlyRole(DATA_PROCESSOR) {
        RetentionPolicy storage pol = retentionPolicies[documentHash];
        require(pol.retainUntil > 0,              "GDPRManager: no retention policy");
        require(block.timestamp >= pol.retainUntil,"GDPRManager: not yet expired");
        require(!pol.legalHoldActive,             "GDPRManager: legal hold active");
        emit DataExpired(documentHash, pol.retainUntil);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getConsent(uint256 consentId) external view returns (ConsentRecord memory) {
        return consentRecords[consentId];
    }

    function getErasureRequest(uint256 requestId) external view returns (ErasureRequest memory) {
        return erasureRequests[requestId];
    }

    function getRetentionPolicy(bytes32 documentHash) external view returns (RetentionPolicy memory) {
        return retentionPolicies[documentHash];
    }

    function isConsentActive(uint256 consentId) external view returns (bool) {
        ConsentRecord storage c = consentRecords[consentId];
        if (c.withdrawn) return false;
        if (c.expiresAt != 0 && block.timestamp > c.expiresAt) return false;
        return true;
    }

    function canErase(bytes32 documentHash) external view returns (bool, string memory) {
        RetentionPolicy storage pol = retentionPolicies[documentHash];
        if (pol.legalHoldActive) return (false, "legal_hold_active");
        if (pol.retainUntil > 0 && block.timestamp < pol.retainUntil)
            return (false, "retention_period_active");
        return (true, "");
    }

    function getSubjectConsents(address subject) external view returns (uint256[] memory) {
        return subjectConsents[subject];
    }

    function getSubjectErasureRequests(address subject) external view returns (uint256[] memory) {
        return subjectErasureRequests[subject];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(GDPR_ADMIN) { _pause(); }
    function unpause() external onlyRole(GDPR_ADMIN) { _unpause(); }
}
