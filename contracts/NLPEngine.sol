// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    NLPEngine.sol
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
 * @title NLPEngine
 * @author AI Autonomous Notary Protocol
 * @notice On-chain coordinator for off-chain NLP analysis of legal documents.
 *         Off-chain NLP nodes (permissioned) submit structured analysis results
 *         which are then anchored on-chain for immutable audit.
 *
 * @dev Follows the same request/response oracle pattern as AIEngine.sol.
 *      Integrates with AIEngine.sol validation requests via shared documentHash.
 *
 *      NLP Analysis includes:
 *      - Legal clause extraction and classification
 *      - Jurisdiction-aware language validation
 *      - Contract type identification
 *      - Anomalous language detection
 *      - Party identification and role assignment
 */
contract NLPEngine is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant NLP_ADMIN       = keccak256("NLP_ADMIN");
    bytes32 public constant NLP_ORACLE      = keccak256("NLP_ORACLE");
    bytes32 public constant REQUESTER_ROLE  = keccak256("REQUESTER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant REQUEST_TIMEOUT = 2 hours;
    uint256 public constant MAX_CLAUSES     = 50;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum DocumentLanguage { ENGLISH, SPANISH, FRENCH, GERMAN, OTHER }
    enum ContractType     { DEED, AGREEMENT, WILL, POA, AFFIDAVIT, PATENT, UNKNOWN }
    enum ClauseRisk       { LOW, MEDIUM, HIGH, CRITICAL }
    enum AnalysisStatus   { PENDING, COMPLETE, FAILED, TIMED_OUT }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct NLPRequest {
        uint256          requestId;
        bytes32          documentHash;
        address          requester;
        uint256          submittedAt;
        uint256          expiresAt;
        string           jurisdiction;
        DocumentLanguage language;
        AnalysisStatus   status;
    }

    struct ClauseResult {
        string    clauseType;       // e.g. "indemnity", "force_majeure"
        string    excerpt;          // Short text excerpt (off-chain hash stored)
        bytes32   excerptHash;      // Keccak of actual text stored off-chain
        ClauseRisk risk;
        bool      flagged;
        string    flagReason;
    }

    struct NLPResult {
        uint256        requestId;
        bytes32        documentHash;
        address        oracle;
        ContractType   contractType;
        uint256        totalClauses;
        uint256        flaggedClauses;
        uint256        riskScore;        // 0-10000 basis points
        bool           jurisdictionCompliant;
        string[]       partyRoles;       // e.g. ["grantor", "grantee"]
        bytes32        resultHash;       // Hash of full off-chain result JSON
        uint256        analyzedAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _requestIdCounter;

    mapping(uint256 => NLPRequest)  public requests;
    mapping(uint256 => NLPResult)   public results;
    mapping(bytes32 => uint256[])   public documentRequests; // documentHash → request IDs
    mapping(uint256 => ClauseResult[]) public clauseResults;

    uint256 public minOracles;   // Minimum oracles needed for consensus

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event NLPAnalysisRequested(
        uint256 indexed requestId,
        bytes32 indexed documentHash,
        address indexed requester,
        string jurisdiction
    );

    event NLPResultSubmitted(
        uint256 indexed requestId,
        bytes32 indexed documentHash,
        address indexed oracle,
        ContractType contractType,
        uint256 riskScore,
        bool jurisdictionCompliant
    );

    event AnalysisTimedOut(uint256 indexed requestId);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, uint256 _minOracles) {
        require(admin       != address(0), "NLPEngine: zero admin");
        require(_minOracles >= 1,         "NLPEngine: min 1 oracle");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(NLP_ADMIN,         admin);

        minOracles = _minOracles;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Request
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Submit a document for NLP analysis.
     * @param documentHash  SHA-256 hash of the document (from DocumentRegistry)
     * @param jurisdiction  ISO 3166-1 country code
     * @param language      Primary document language
     */
    function requestAnalysis(
        bytes32          documentHash,
        string calldata  jurisdiction,
        DocumentLanguage language
    ) external nonReentrant whenNotPaused onlyRole(REQUESTER_ROLE) returns (uint256 requestId) {
        require(documentHash != bytes32(0), "NLPEngine: zero hash");

        _requestIdCounter.increment();
        requestId = _requestIdCounter.current();

        requests[requestId] = NLPRequest({
            requestId:   requestId,
            documentHash: documentHash,
            requester:   msg.sender,
            submittedAt: block.timestamp,
            expiresAt:   block.timestamp + REQUEST_TIMEOUT,
            jurisdiction: jurisdiction,
            language:    language,
            status:      AnalysisStatus.PENDING
        });

        documentRequests[documentHash].push(requestId);

        emit NLPAnalysisRequested(requestId, documentHash, msg.sender, jurisdiction);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Oracle Response
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice NLP oracle submits analysis result on-chain.
     * @param requestId             Request being fulfilled
     * @param contractType          Classified document type
     * @param riskScore             Overall risk score (0-10000)
     * @param jurisdictionCompliant Whether document language is jurisdiction-compliant
     * @param partyRoles            Identified party roles in the document
     * @param clauses               Extracted clause analysis
     * @param resultHash            Keccak of full JSON result stored off-chain
     */
    function submitResult(
        uint256          requestId,
        ContractType     contractType,
        uint256          riskScore,
        bool             jurisdictionCompliant,
        string[] calldata partyRoles,
        ClauseResult[] calldata clauses,
        bytes32          resultHash
    ) external nonReentrant onlyRole(NLP_ORACLE) {
        NLPRequest storage req = requests[requestId];
        require(req.requestId != 0,                    "NLPEngine: request not found");
        require(req.status == AnalysisStatus.PENDING,  "NLPEngine: not pending");
        require(riskScore    <= 10_000,                "NLPEngine: invalid risk score");
        require(clauses.length <= MAX_CLAUSES,         "NLPEngine: too many clauses");

        if (block.timestamp > req.expiresAt) {
            req.status = AnalysisStatus.TIMED_OUT;
            emit AnalysisTimedOut(requestId);
            return;
        }

        req.status = AnalysisStatus.COMPLETE;

        uint256 flaggedCount;
        for (uint256 i = 0; i < clauses.length; i++) {
            clauseResults[requestId].push(clauses[i]);
            if (clauses[i].flagged) flaggedCount++;
        }

        results[requestId] = NLPResult({
            requestId:            requestId,
            documentHash:         req.documentHash,
            oracle:               msg.sender,
            contractType:         contractType,
            totalClauses:         clauses.length,
            flaggedClauses:       flaggedCount,
            riskScore:            riskScore,
            jurisdictionCompliant: jurisdictionCompliant,
            partyRoles:           partyRoles,
            resultHash:           resultHash,
            analyzedAt:           block.timestamp
        });

        emit NLPResultSubmitted(
            requestId,
            req.documentHash,
            msg.sender,
            contractType,
            riskScore,
            jurisdictionCompliant
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getRequest(uint256 requestId) external view returns (NLPRequest memory) {
        return requests[requestId];
    }

    function getResult(uint256 requestId) external view returns (NLPResult memory) {
        return results[requestId];
    }

    function getClauses(uint256 requestId) external view returns (ClauseResult[] memory) {
        return clauseResults[requestId];
    }

    function getDocumentRequests(bytes32 documentHash) external view returns (uint256[] memory) {
        return documentRequests[documentHash];
    }

    function latestResult(bytes32 documentHash) external view returns (NLPResult memory) {
        uint256[] storage reqIds = documentRequests[documentHash];
        for (uint256 i = reqIds.length; i > 0; i--) {
            uint256 rid = reqIds[i - 1];
            if (requests[rid].status == AnalysisStatus.COMPLETE) {
                return results[rid];
            }
        }
        revert("NLPEngine: no complete result");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function addOracle(address oracle) external onlyRole(NLP_ADMIN) {
        require(oracle != address(0), "NLPEngine: zero address");
        _grantRole(NLP_ORACLE, oracle);
    }

    function removeOracle(address oracle) external onlyRole(NLP_ADMIN) {
        _revokeRole(NLP_ORACLE, oracle);
    }

    function addRequester(address requester) external onlyRole(NLP_ADMIN) {
        _grantRole(REQUESTER_ROLE, requester);
    }

    function setMinOracles(uint256 _minOracles) external onlyRole(NLP_ADMIN) {
        require(_minOracles >= 1, "NLPEngine: min 1");
        minOracles = _minOracles;
    }

    function pause()   external onlyRole(NLP_ADMIN) { _pause(); }
    function unpause() external onlyRole(NLP_ADMIN) { _unpause(); }
}
