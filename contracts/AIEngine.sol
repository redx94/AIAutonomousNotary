// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AIEngine
 * @author AI Autonomous Notary Protocol
 * @notice On-chain coordinator for decentralized AI document validation.
 *         Manages validation requests, aggregates oracle responses, enforces
 *         consensus thresholds, and issues validation certificates.
 * @dev Uses a request/response pattern compatible with Chainlink Functions,
 *      custom off-chain AI oracle nodes, and future on-chain ML verifiers.
 *      Validation consensus requires 2-of-3 oracle agreement by default.
 */
contract AIEngine is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant AI_ORACLE_ROLE  = keccak256("AI_ORACLE_ROLE");
    bytes32 public constant ENGINE_ADMIN    = keccak256("ENGINE_ADMIN");
    bytes32 public constant REQUESTOR_ROLE  = keccak256("REQUESTOR_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum ValidationStatus {
        PENDING,      // Awaiting oracle responses
        CONSENSUS,    // Sufficient oracle agreement reached
        REJECTED,     // AI determined document is invalid/fraudulent
        DISPUTED,     // Conflicting oracle responses; requires human review
        EXPIRED,      // Request timed out
        CANCELLED     // Manually cancelled
    }

    enum DocumentCategory {
        IDENTITY_DOCUMENT,   // Passport, driver's license, etc.
        LEGAL_CONTRACT,      // Contracts, agreements
        PROPERTY_DEED,       // Real estate documents
        FINANCIAL_INSTRUMENT, // Bonds, promissory notes
        CORPORATE_DOCUMENT,  // Articles, bylaws, resolutions
        MEDICAL_RECORD,      // HIPAA-regulated records
        COURT_DOCUMENT,      // Legal filings, judgments
        GENERAL              // All other documents
    }

    struct ValidationRequest {
        uint256   requestId;
        bytes32   documentHash;
        bytes32   metadataHash;        // Hash of off-chain metadata
        address   requester;
        uint256   createdAt;
        uint256   expiresAt;
        uint256   documentRegistryId;  // LinkedDocumentRegistry ID (0 if standalone)
        DocumentCategory category;
        ValidationStatus status;
        uint256   consensusThreshold;  // Min oracle responses required
        uint256   positiveResponses;
        uint256   negativeResponses;
        uint256   totalResponses;
        uint256   confidenceScore;     // Aggregated 0-10000 (basis points)
        bool      identityVerified;
        bool      documentAuthentic;
        bool      signatureValid;
        bool      tamperDetected;
        bytes32   validationCertHash;  // Hash of issued certificate
    }

    struct OracleResponse {
        address  oracle;
        uint256  timestamp;
        bool     isValid;
        uint256  confidence;           // 0-10000 basis points
        uint256  fraudScore;           // 0-10000, higher = more suspicious
        bool     identityVerified;
        bool     documentAuthentic;
        bool     signatureValid;
        bool     tamperDetected;
        bytes32  analysisHash;         // Hash of off-chain detailed analysis
    }

    struct ValidationCertificate {
        uint256  requestId;
        bytes32  documentHash;
        address  issuedTo;
        uint256  issuedAt;
        uint256  validUntil;
        uint256  confidenceScore;
        bool     isValid;
        bytes32  certHash;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _requestIdCounter;
    Counters.Counter private _certIdCounter;

    uint256 public defaultConsensusThreshold = 2;  // Out of 3 oracles
    uint256 public requestTimeout            = 1 hours;
    uint256 public certificateValidity       = 365 days;
    uint256 public maxFraudScoreThreshold    = 3000; // 30% suspicion = reject

    mapping(uint256 => ValidationRequest) public requests;
    mapping(uint256 => OracleResponse[])  public oracleResponses;
    mapping(uint256 => mapping(address => bool)) public hasResponded;

    mapping(uint256 => ValidationCertificate) public certificates;
    mapping(bytes32 => uint256) public documentHashToRequestId;
    mapping(bytes32 => uint256) public documentHashToCertId;

    // Registered AI oracle addresses
    address[] public registeredOracles;
    mapping(address => bool) public isRegisteredOracle;

    // Stats
    uint256 public totalValidated;
    uint256 public totalRejected;
    uint256 public totalDisputed;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ValidationRequested(
        uint256 indexed requestId,
        bytes32 indexed documentHash,
        address indexed requester,
        DocumentCategory category,
        uint256 expiresAt
    );

    event OracleResponseReceived(
        uint256 indexed requestId,
        address indexed oracle,
        bool    isValid,
        uint256 confidence,
        uint256 fraudScore,
        uint256 timestamp
    );

    event ConsensusReached(
        uint256 indexed requestId,
        bytes32 indexed documentHash,
        bool    isValid,
        uint256 confidenceScore,
        uint256 positiveCount,
        uint256 negativeCount
    );

    event ValidationCertificateIssued(
        uint256 indexed certId,
        uint256 indexed requestId,
        bytes32 indexed documentHash,
        address issuedTo,
        uint256 validUntil
    );

    event ValidationExpired(uint256 indexed requestId, uint256 timestamp);
    event ValidationCancelled(uint256 indexed requestId, address indexed cancelledBy);

    event OracleRegistered(address indexed oracle);
    event OracleDeregistered(address indexed oracle);
    event EngineParameterUpdated(string parameter, uint256 newValue);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address[] memory initialOracles) {
        require(admin != address(0), "AIEngine: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ENGINE_ADMIN,       admin);
        _grantRole(REQUESTOR_ROLE,     admin);

        for (uint256 i = 0; i < initialOracles.length; i++) {
            require(initialOracles[i] != address(0), "AIEngine: zero oracle");
            _registerOracle(initialOracles[i]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Request Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Submit a new AI validation request for a document
     * @param documentHash       SHA-256 hash of document content
     * @param metadataHash       Hash of off-chain metadata
     * @param category           Document classification
     * @param documentRegistryId Linked registry ID (0 if not yet registered)
     * @return requestId         Unique request identifier
     */
    function requestValidation(
        bytes32          documentHash,
        bytes32          metadataHash,
        DocumentCategory category,
        uint256          documentRegistryId
    )
        external
        onlyRole(REQUESTOR_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 requestId)
    {
        require(documentHash != bytes32(0),    "AIEngine: null document hash");
        require(
            documentHashToRequestId[documentHash] == 0,
            "AIEngine: document already has pending request"
        );

        _requestIdCounter.increment();
        requestId = _requestIdCounter.current();

        uint256 expiresAt = block.timestamp + requestTimeout;

        requests[requestId] = ValidationRequest({
            requestId:            requestId,
            documentHash:         documentHash,
            metadataHash:         metadataHash,
            requester:            msg.sender,
            createdAt:            block.timestamp,
            expiresAt:            expiresAt,
            documentRegistryId:   documentRegistryId,
            category:             category,
            status:               ValidationStatus.PENDING,
            consensusThreshold:   defaultConsensusThreshold,
            positiveResponses:    0,
            negativeResponses:    0,
            totalResponses:       0,
            confidenceScore:      0,
            identityVerified:     false,
            documentAuthentic:    false,
            signatureValid:       false,
            tamperDetected:       false,
            validationCertHash:   bytes32(0)
        });

        documentHashToRequestId[documentHash] = requestId;

        emit ValidationRequested(requestId, documentHash, msg.sender, category, expiresAt);
    }

    /**
     * @notice AI oracle submits its validation response
     * @param requestId        The validation request ID
     * @param isValid          Whether the oracle deems the document valid
     * @param confidence       Confidence score in basis points (0-10000)
     * @param fraudScore       Fraud suspicion in basis points (0-10000)
     * @param identityVerified Oracle's identity verification result
     * @param documentAuthentic Oracle's authenticity assessment
     * @param signatureValid   Oracle's signature verification result
     * @param tamperDetected   Whether tampering was detected
     * @param analysisHash     Hash of detailed off-chain analysis
     */
    function submitOracleResponse(
        uint256 requestId,
        bool    isValid,
        uint256 confidence,
        uint256 fraudScore,
        bool    identityVerified,
        bool    documentAuthentic,
        bool    signatureValid,
        bool    tamperDetected,
        bytes32 analysisHash
    )
        external
        onlyRole(AI_ORACLE_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(isRegisteredOracle[msg.sender],        "AIEngine: unregistered oracle");
        require(requests[requestId].requestId != 0,   "AIEngine: request does not exist");
        require(!hasResponded[requestId][msg.sender],  "AIEngine: oracle already responded");

        ValidationRequest storage req = requests[requestId];
        require(req.status == ValidationStatus.PENDING, "AIEngine: request not pending");

        // Check expiry
        if (block.timestamp > req.expiresAt) {
            req.status = ValidationStatus.EXPIRED;
            emit ValidationExpired(requestId, block.timestamp);
            return;
        }

        require(confidence <= 10000, "AIEngine: invalid confidence score");
        require(fraudScore  <= 10000, "AIEngine: invalid fraud score");

        // Record response
        hasResponded[requestId][msg.sender] = true;
        oracleResponses[requestId].push(OracleResponse({
            oracle:            msg.sender,
            timestamp:         block.timestamp,
            isValid:           isValid,
            confidence:        confidence,
            fraudScore:        fraudScore,
            identityVerified:  identityVerified,
            documentAuthentic: documentAuthentic,
            signatureValid:    signatureValid,
            tamperDetected:    tamperDetected,
            analysisHash:      analysisHash
        }));

        req.totalResponses++;

        // Immediately reject if fraud score is critical
        if (fraudScore > maxFraudScoreThreshold) {
            req.status = ValidationStatus.REJECTED;
            req.tamperDetected = true;
            totalRejected++;
            emit ConsensusReached(requestId, req.documentHash, false, 0, 0, req.totalResponses);
            return;
        }

        if (isValid) {
            req.positiveResponses++;
        } else {
            req.negativeResponses++;
        }

        // Aggregate confidence score (running average)
        req.confidenceScore = (req.confidenceScore * (req.totalResponses - 1) + confidence) / req.totalResponses;

        emit OracleResponseReceived(requestId, msg.sender, isValid, confidence, fraudScore, block.timestamp);

        // Check for consensus
        _checkConsensus(requestId);
    }

    /**
     * @notice Cancel a pending validation request (requester or admin only)
     */
    function cancelValidation(uint256 requestId)
        external
        nonReentrant
    {
        ValidationRequest storage req = requests[requestId];
        require(req.requestId != 0, "AIEngine: request does not exist");
        require(req.status == ValidationStatus.PENDING, "AIEngine: not pending");
        require(
            msg.sender == req.requester || hasRole(ENGINE_ADMIN, msg.sender),
            "AIEngine: unauthorized"
        );

        req.status = ValidationStatus.CANCELLED;
        delete documentHashToRequestId[req.documentHash];
        emit ValidationCancelled(requestId, msg.sender);
    }

    /**
     * @notice Expire a timed-out request (callable by anyone)
     */
    function expireRequest(uint256 requestId) external {
        ValidationRequest storage req = requests[requestId];
        require(req.requestId != 0,          "AIEngine: request does not exist");
        require(req.status == ValidationStatus.PENDING, "AIEngine: not pending");
        require(block.timestamp > req.expiresAt, "AIEngine: not yet expired");

        req.status = ValidationStatus.EXPIRED;
        delete documentHashToRequestId[req.documentHash];
        emit ValidationExpired(requestId, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Oracle Management
    // ─────────────────────────────────────────────────────────────────────────

    function registerOracle(address oracle) external onlyRole(ENGINE_ADMIN) {
        require(oracle != address(0), "AIEngine: zero oracle");
        require(!isRegisteredOracle[oracle], "AIEngine: already registered");
        _registerOracle(oracle);
        _grantRole(AI_ORACLE_ROLE, oracle);
    }

    function deregisterOracle(address oracle) external onlyRole(ENGINE_ADMIN) {
        require(isRegisteredOracle[oracle], "AIEngine: not registered");
        isRegisteredOracle[oracle] = false;
        _revokeRole(AI_ORACLE_ROLE, oracle);
        emit OracleDeregistered(oracle);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getRequest(uint256 requestId)
        external
        view
        returns (ValidationRequest memory)
    {
        return requests[requestId];
    }

    function getOracleResponses(uint256 requestId)
        external
        view
        returns (OracleResponse[] memory)
    {
        return oracleResponses[requestId];
    }

    function getCertificate(uint256 certId)
        external
        view
        returns (ValidationCertificate memory)
    {
        return certificates[certId];
    }

    function isCertificateValid(uint256 certId) external view returns (bool) {
        ValidationCertificate storage cert = certificates[certId];
        if (cert.requestId == 0) return false;
        if (!cert.isValid)       return false;
        if (block.timestamp > cert.validUntil) return false;
        return true;
    }

    function getRegisteredOracles() external view returns (address[] memory) {
        return registeredOracles;
    }

    function totalRequests() external view returns (uint256) {
        return _requestIdCounter.current();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin Parameters
    // ─────────────────────────────────────────────────────────────────────────

    function setConsensusThreshold(uint256 threshold) external onlyRole(ENGINE_ADMIN) {
        require(threshold >= 1 && threshold <= registeredOracles.length, "AIEngine: invalid threshold");
        defaultConsensusThreshold = threshold;
        emit EngineParameterUpdated("consensusThreshold", threshold);
    }

    function setRequestTimeout(uint256 timeout) external onlyRole(ENGINE_ADMIN) {
        require(timeout >= 30 minutes && timeout <= 7 days, "AIEngine: invalid timeout");
        requestTimeout = timeout;
        emit EngineParameterUpdated("requestTimeout", timeout);
    }

    function setMaxFraudScoreThreshold(uint256 threshold) external onlyRole(ENGINE_ADMIN) {
        require(threshold <= 10000, "AIEngine: invalid threshold");
        maxFraudScoreThreshold = threshold;
        emit EngineParameterUpdated("maxFraudScoreThreshold", threshold);
    }

    function setCertificateValidity(uint256 validity) external onlyRole(ENGINE_ADMIN) {
        require(validity >= 1 days, "AIEngine: validity too short");
        certificateValidity = validity;
        emit EngineParameterUpdated("certificateValidity", validity);
    }

    function pause()   external onlyRole(ENGINE_ADMIN) { _pause(); }
    function unpause() external onlyRole(ENGINE_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _checkConsensus(uint256 requestId) internal {
        ValidationRequest storage req = requests[requestId];
        uint256 totalRegistered = registeredOracles.length;
        uint256 maxPossibleRemaining = totalRegistered - req.totalResponses;

        // Positive consensus
        if (req.positiveResponses >= req.consensusThreshold) {
            req.status            = ValidationStatus.CONSENSUS;
            req.documentAuthentic = true;
            req.identityVerified  = true;
            req.signatureValid    = true;
            totalValidated++;
            _issueCertificate(requestId);
            emit ConsensusReached(
                requestId,
                req.documentHash,
                true,
                req.confidenceScore,
                req.positiveResponses,
                req.negativeResponses
            );
            return;
        }

        // Negative consensus (majority reject)
        if (req.negativeResponses > req.positiveResponses + maxPossibleRemaining) {
            req.status = ValidationStatus.REJECTED;
            totalRejected++;
            emit ConsensusReached(
                requestId,
                req.documentHash,
                false,
                req.confidenceScore,
                req.positiveResponses,
                req.negativeResponses
            );
            return;
        }

        // Disputed: all oracles responded but no clear consensus
        if (
            req.totalResponses == totalRegistered &&
            req.positiveResponses < req.consensusThreshold
        ) {
            req.status = ValidationStatus.DISPUTED;
            totalDisputed++;
            emit ConsensusReached(
                requestId,
                req.documentHash,
                false,
                req.confidenceScore,
                req.positiveResponses,
                req.negativeResponses
            );
        }
    }

    function _issueCertificate(uint256 requestId) internal {
        ValidationRequest storage req = requests[requestId];
        _certIdCounter.increment();
        uint256 certId = _certIdCounter.current();

        bytes32 certHash = keccak256(abi.encodePacked(
            requestId,
            req.documentHash,
            req.requester,
            req.confidenceScore,
            block.timestamp
        ));

        certificates[certId] = ValidationCertificate({
            requestId:       requestId,
            documentHash:    req.documentHash,
            issuedTo:        req.requester,
            issuedAt:        block.timestamp,
            validUntil:      block.timestamp + certificateValidity,
            confidenceScore: req.confidenceScore,
            isValid:         true,
            certHash:        certHash
        });

        req.validationCertHash = certHash;
        documentHashToCertId[req.documentHash] = certId;

        emit ValidationCertificateIssued(certId, requestId, req.documentHash, req.requester, block.timestamp + certificateValidity);
    }

    function _registerOracle(address oracle) internal {
        isRegisteredOracle[oracle] = true;
        registeredOracles.push(oracle);
        emit OracleRegistered(oracle);
    }
}
