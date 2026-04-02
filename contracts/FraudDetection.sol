// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    FraudDetection.sol
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
 * @title FraudDetection
 * @author AI Autonomous Notary Protocol
 * @notice Advanced anomaly-scoring fraud registry. Aggregates signals from
 *         multiple off-chain ML models and on-chain behavioral patterns to
 *         produce a composable fraud score per document and per address.
 *
 * @dev Fraud scores are sourced from:
 *   1. Off-chain ML models (submitted by permissioned FRAUD_ORACLE nodes)
 *   2. On-chain behavioral heuristics (velocity, repetition, known bad actors)
 *   3. Cross-document clustering (documents sharing suspiciously similar hashes)
 *
 *   The composite score (0-10000 basis points, higher = more suspicious) is
 *   consumed by AIEngine.sol and the compliance overlay PolicyEngine.
 *   Score >= ALERT_THRESHOLD triggers an immutable alert record.
 */
contract FraudDetection is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant FRAUD_ADMIN   = keccak256("FRAUD_ADMIN");
    bytes32 public constant FRAUD_ORACLE  = keccak256("FRAUD_ORACLE");
    bytes32 public constant ANALYST_ROLE  = keccak256("ANALYST_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant MAX_SCORE      = 10_000;
    uint256 public constant ALERT_THRESHOLD = 3_000; // 30% — matches AIEngine default
    uint256 public constant BLACKLIST_THRESHOLD = 7_000; // 70% — auto-flag for review

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum SignalType {
        DOCUMENT_TAMPER,
        IDENTITY_MISMATCH,
        VELOCITY_ANOMALY,
        DUPLICATE_HASH,
        SANCTIONS_MATCH,
        BEHAVIORAL_PATTERN,
        ML_MODEL_FLAG,
        HUMAN_ANALYST_FLAG
    }

    struct FraudSignal {
        uint256    signalId;
        bytes32    documentHash;
        address    subject;          // Address under scrutiny (0 = document-only signal)
        SignalType signalType;
        uint256    score;            // Contribution to composite score (0-10000)
        address    reporter;         // Oracle or analyst address
        uint256    reportedAt;
        string     evidence;         // IPFS CID or off-chain reference
        bool       verified;         // Confirmed by ANALYST_ROLE
        bool       disputed;
    }

    struct DocumentFraudProfile {
        bytes32  documentHash;
        uint256  compositeScore;     // Weighted average of all signals
        uint256  signalCount;
        bool     alertActive;
        bool     blacklisted;
        uint256  lastUpdated;
    }

    struct AddressFraudProfile {
        address  subject;
        uint256  compositeScore;
        uint256  documentCount;      // Number of documents this address is involved in
        bool     watchlisted;
        bool     blacklisted;
        uint256  lastUpdated;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _signalIdCounter;

    mapping(uint256 => FraudSignal)          public signals;
    mapping(bytes32 => DocumentFraudProfile) public documentProfiles;
    mapping(address => AddressFraudProfile)  public addressProfiles;
    mapping(bytes32 => uint256[])            public documentSignals; // hash → signal IDs
    mapping(address => uint256[])            public addressSignals;  // addr → signal IDs

    // Cross-document clustering: near-duplicate document hashes
    mapping(bytes32 => bytes32[]) public similarDocuments;

    uint256 public totalAlerts;
    uint256 public totalBlacklisted;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event SignalReported(
        uint256 indexed signalId,
        bytes32 indexed documentHash,
        address indexed subject,
        SignalType signalType,
        uint256 score
    );

    event AlertTriggered(bytes32 indexed documentHash, uint256 compositeScore);
    event Blacklisted(bytes32 indexed documentHash, address indexed subject);
    event SignalVerified(uint256 indexed signalId, address indexed analyst);
    event SignalDisputed(uint256 indexed signalId, address indexed disputer);
    event SimilarDocumentLinked(bytes32 indexed documentA, bytes32 indexed documentB);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin) {
        require(admin != address(0), "FraudDetection: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FRAUD_ADMIN,        admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Signal Reporting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Report a fraud signal for a document (and optionally an address).
     *         Called by off-chain ML models (via FRAUD_ORACLE role) or analysts.
     * @param documentHash Hash of the document under scrutiny
     * @param subject      Address involved (set to address(0) for document-only)
     * @param signalType   Type of fraud signal
     * @param score        Signal contribution score (0-10000)
     * @param evidence     IPFS CID or description of evidence
     */
    function reportSignal(
        bytes32    documentHash,
        address    subject,
        SignalType signalType,
        uint256    score,
        string calldata evidence
    ) external nonReentrant whenNotPaused returns (uint256 signalId) {
        require(
            hasRole(FRAUD_ORACLE, msg.sender) || hasRole(ANALYST_ROLE, msg.sender),
            "FraudDetection: unauthorized"
        );
        require(documentHash != bytes32(0), "FraudDetection: zero hash");
        require(score         <= MAX_SCORE,  "FraudDetection: invalid score");

        _signalIdCounter.increment();
        signalId = _signalIdCounter.current();

        signals[signalId] = FraudSignal({
            signalId:    signalId,
            documentHash: documentHash,
            subject:     subject,
            signalType:  signalType,
            score:       score,
            reporter:    msg.sender,
            reportedAt:  block.timestamp,
            evidence:    evidence,
            verified:    false,
            disputed:    false
        });

        documentSignals[documentHash].push(signalId);
        if (subject != address(0)) {
            addressSignals[subject].push(signalId);
        }

        _updateDocumentProfile(documentHash, score);
        if (subject != address(0)) _updateAddressProfile(subject, score);

        emit SignalReported(signalId, documentHash, subject, signalType, score);
    }

    /**
     * @notice Link two near-duplicate documents (cross-document clustering).
     *         Called by FRAUD_ORACLE after similarity analysis.
     */
    function linkSimilarDocuments(bytes32 docA, bytes32 docB) external onlyRole(FRAUD_ORACLE) {
        require(docA != docB, "FraudDetection: same document");
        similarDocuments[docA].push(docB);
        similarDocuments[docB].push(docA);
        emit SimilarDocumentLinked(docA, docB);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Verification & Dispute
    // ─────────────────────────────────────────────────────────────────────────

    function verifySignal(uint256 signalId) external onlyRole(ANALYST_ROLE) {
        signals[signalId].verified = true;
        emit SignalVerified(signalId, msg.sender);
    }

    function disputeSignal(uint256 signalId) external onlyRole(ANALYST_ROLE) {
        signals[signalId].disputed = true;
        emit SignalDisputed(signalId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getDocumentProfile(bytes32 documentHash)
        external view returns (DocumentFraudProfile memory)
    {
        return documentProfiles[documentHash];
    }

    function getAddressProfile(address subject)
        external view returns (AddressFraudProfile memory)
    {
        return addressProfiles[subject];
    }

    function getDocumentSignals(bytes32 documentHash)
        external view returns (uint256[] memory)
    {
        return documentSignals[documentHash];
    }

    function isDocumentBlacklisted(bytes32 documentHash) external view returns (bool) {
        return documentProfiles[documentHash].blacklisted;
    }

    function isAddressBlacklisted(address subject) external view returns (bool) {
        return addressProfiles[subject].blacklisted;
    }

    function getSimilarDocuments(bytes32 documentHash) external view returns (bytes32[] memory) {
        return similarDocuments[documentHash];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function addOracle(address oracle) external onlyRole(FRAUD_ADMIN) {
        require(oracle != address(0), "FraudDetection: zero address");
        _grantRole(FRAUD_ORACLE, oracle);
    }

    function addAnalyst(address analyst) external onlyRole(FRAUD_ADMIN) {
        _grantRole(ANALYST_ROLE, analyst);
    }

    function manualBlacklist(bytes32 documentHash) external onlyRole(FRAUD_ADMIN) {
        documentProfiles[documentHash].blacklisted = true;
        totalBlacklisted++;
        emit Blacklisted(documentHash, address(0));
    }

    function manualBlacklistAddress(address subject) external onlyRole(FRAUD_ADMIN) {
        addressProfiles[subject].blacklisted = true;
        emit Blacklisted(bytes32(0), subject);
    }

    function pause()   external onlyRole(FRAUD_ADMIN) { _pause(); }
    function unpause() external onlyRole(FRAUD_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _updateDocumentProfile(bytes32 documentHash, uint256 newScore) internal {
        DocumentFraudProfile storage profile = documentProfiles[documentHash];
        profile.documentHash  = documentHash;

        // Running weighted average
        if (profile.signalCount == 0) {
            profile.compositeScore = newScore;
        } else {
            profile.compositeScore =
                (profile.compositeScore * profile.signalCount + newScore) /
                (profile.signalCount + 1);
        }
        profile.signalCount++;
        profile.lastUpdated = block.timestamp;

        if (!profile.alertActive && profile.compositeScore >= ALERT_THRESHOLD) {
            profile.alertActive = true;
            totalAlerts++;
            emit AlertTriggered(documentHash, profile.compositeScore);
        }

        if (!profile.blacklisted && profile.compositeScore >= BLACKLIST_THRESHOLD) {
            profile.blacklisted = true;
            totalBlacklisted++;
            emit Blacklisted(documentHash, address(0));
        }
    }

    function _updateAddressProfile(address subject, uint256 newScore) internal {
        AddressFraudProfile storage profile = addressProfiles[subject];
        profile.subject = subject;

        if (profile.documentCount == 0) {
            profile.compositeScore = newScore;
        } else {
            profile.compositeScore =
                (profile.compositeScore * profile.documentCount + newScore) /
                (profile.documentCount + 1);
        }
        profile.documentCount++;
        profile.lastUpdated = block.timestamp;

        if (!profile.watchlisted && profile.compositeScore >= ALERT_THRESHOLD) {
            profile.watchlisted = true;
        }

        if (!profile.blacklisted && profile.compositeScore >= BLACKLIST_THRESHOLD) {
            profile.blacklisted = true;
            emit Blacklisted(bytes32(0), subject);
        }
    }
}
