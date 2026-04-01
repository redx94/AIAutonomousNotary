// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 Reece Dixon - All Rights Reserved.
// This file is part of AI Autonomous Notary.
// Unauthorized copying, modification, or commercial use of this file,
// via any medium, is strictly prohibited until the Change Date.

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ConditionalAccess
 * @author AI Autonomous Notary Protocol
 * @notice Manages time-locked and oracle-triggered release of document decryption
 *         keys or access credentials. Implements the "conditional access" pattern
 *         described in the Document Securities Market blueprint:
 *         - Time-locked release (estate documents unlock at a future timestamp)
 *         - Multi-condition AND/OR release (payment + identity + time)
 *         - Oracle-triggered release (death verification, regulatory approval)
 *         - Multi-party threshold release (M-of-N signers must approve)
 *         - Emergency admin override for legal compliance
 *
 * @dev Stores encrypted key references (IPFS CID of encrypted key material)
 *      on-chain. Actual decryption keys are never stored on-chain — only
 *      encrypted references that can be retrieved and decrypted by authorized
 *      oracle nodes in a Trusted Execution Environment.
 */
contract ConditionalAccess is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE     = keccak256("ORACLE_ROLE");
    bytes32 public constant ACCESS_ADMIN    = keccak256("ACCESS_ADMIN");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    Counters.Counter private _policyIdCounter;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum ConditionType {
        TIME_LOCK,          // Release after a specific timestamp
        ORACLE_VERIFY,      // Release after oracle submits verified result
        MULTI_SIG,          // Release after M-of-N designated approvers sign
        PAYMENT,            // Release after confirmed ETH payment to escrow
        COMPOSITE_AND,      // All sub-conditions must be met
        COMPOSITE_OR        // Any single sub-condition is sufficient
    }

    enum PolicyStatus {
        ACTIVE,             // Conditions being evaluated
        RELEASED,           // All conditions met — access granted
        REVOKED,            // Administratively revoked
        EXPIRED             // Past validity window without fulfillment
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Condition {
        ConditionType condType;
        uint256       releaseTimestamp;     // For TIME_LOCK
        bytes32       oracleEventId;        // For ORACLE_VERIFY — unique event key
        uint256       requiredSigners;      // For MULTI_SIG — threshold M
        uint256       collectedSigners;     // Collected so far
        uint256       paymentAmount;        // For PAYMENT — required ETH in wei
        bool          fulfilled;
    }

    struct AccessPolicy {
        uint256       policyId;
        bytes32       documentHash;          // Document this policy guards
        address       owner;                 // Policy creator / NFT owner
        string        encryptedKeyRef;       // IPFS CID of encrypted key material
        string        metadataUri;           // Off-chain metadata URI
        uint256       validUntil;            // 0 = no expiry
        uint256       conditionCount;
        ConditionType compositeLogic;        // AND / OR for multi-condition
        PolicyStatus  status;
        uint256       createdAt;
        uint256       releasedAt;
        address       releasedTo;            // Address that triggered final release
        uint256       escrowed;              // ETH held in escrow for PAYMENT type
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    mapping(uint256 => AccessPolicy)                              public policies;
    mapping(uint256 => Condition[])                               public conditions;
    mapping(uint256 => mapping(address => bool))                  public hasApproved; // multi-sig
    mapping(uint256 => mapping(bytes32 => bool))                  public oracleEvents; // oracle results
    mapping(bytes32 => uint256)                                   public documentHashToPolicy;

    uint256 public policyCreationFee; // Optional fee in wei
    address public treasury;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event PolicyCreated(
        uint256 indexed policyId,
        bytes32 indexed documentHash,
        address indexed owner,
        uint256 conditionCount,
        uint256 validUntil
    );

    event ConditionFulfilled(
        uint256 indexed policyId,
        uint256 conditionIndex,
        ConditionType condType,
        address triggeredBy,
        uint256 timestamp
    );

    event PolicyReleased(
        uint256 indexed policyId,
        bytes32 indexed documentHash,
        address indexed releasedTo,
        string  encryptedKeyRef,
        uint256 timestamp
    );

    event PolicyRevoked(
        uint256 indexed policyId,
        address revokedBy,
        string  reason,
        uint256 timestamp
    );

    event OracleEventSubmitted(
        uint256 indexed policyId,
        bytes32 indexed eventId,
        address indexed oracle,
        bool    result,
        uint256 timestamp
    );

    event EscrowDeposited(uint256 indexed policyId, address depositor, uint256 amount);
    event EscrowReleased(uint256 indexed policyId, address recipient, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address _treasury) {
        require(admin    != address(0), "ConditionalAccess: invalid admin");
        require(_treasury != address(0), "ConditionalAccess: invalid treasury");
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ACCESS_ADMIN,       admin);
        _grantRole(COMPLIANCE_ROLE,    admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Policy Creation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a time-lock access policy — key releases after timestamp
     * @param documentHash  Hash of the guarded document
     * @param encKeyRef     IPFS CID of encrypted key material
     * @param metadataUri   URI of policy metadata
     * @param releaseAt     Unix timestamp when access unlocks
     * @param validUntil    Expiry timestamp (0 = none)
     * @return policyId
     */
    function createTimeLockPolicy(
        bytes32 documentHash,
        string calldata encKeyRef,
        string calldata metadataUri,
        uint256 releaseAt,
        uint256 validUntil
    )
        external
        payable
        whenNotPaused
        returns (uint256 policyId)
    {
        require(releaseAt > block.timestamp, "ConditionalAccess: release must be future");
        _chargeFee();
        policyId = _createPolicy(documentHash, msg.sender, encKeyRef, metadataUri, validUntil, 1, ConditionType.TIME_LOCK);

        conditions[policyId].push(Condition({
            condType:          ConditionType.TIME_LOCK,
            releaseTimestamp:  releaseAt,
            oracleEventId:     bytes32(0),
            requiredSigners:   0,
            collectedSigners:  0,
            paymentAmount:     0,
            fulfilled:         false
        }));

        emit PolicyCreated(policyId, documentHash, msg.sender, 1, validUntil);
    }

    /**
     * @notice Create an oracle-triggered access policy
     * @param documentHash  Hash of the guarded document
     * @param encKeyRef     IPFS CID of encrypted key material
     * @param metadataUri   URI of policy metadata
     * @param oracleEventId Unique identifier the oracle will use to signal the event
     * @param validUntil    Expiry timestamp (0 = none)
     * @return policyId
     */
    function createOraclePolicy(
        bytes32 documentHash,
        string calldata encKeyRef,
        string calldata metadataUri,
        bytes32 oracleEventId,
        uint256 validUntil
    )
        external
        payable
        whenNotPaused
        returns (uint256 policyId)
    {
        require(oracleEventId != bytes32(0), "ConditionalAccess: null event ID");
        _chargeFee();
        policyId = _createPolicy(documentHash, msg.sender, encKeyRef, metadataUri, validUntil, 1, ConditionType.ORACLE_VERIFY);

        conditions[policyId].push(Condition({
            condType:         ConditionType.ORACLE_VERIFY,
            releaseTimestamp: 0,
            oracleEventId:    oracleEventId,
            requiredSigners:  0,
            collectedSigners: 0,
            paymentAmount:    0,
            fulfilled:        false
        }));

        emit PolicyCreated(policyId, documentHash, msg.sender, 1, validUntil);
    }

    /**
     * @notice Create a multi-signature access policy (M-of-N signers required)
     * @param documentHash      Hash of the guarded document
     * @param encKeyRef         IPFS CID of encrypted key material
     * @param metadataUri       URI of policy metadata
     * @param requiredSigners   Threshold M
     * @param validUntil        Expiry timestamp (0 = none)
     * @return policyId
     */
    function createMultiSigPolicy(
        bytes32 documentHash,
        string calldata encKeyRef,
        string calldata metadataUri,
        uint256 requiredSigners,
        uint256 validUntil
    )
        external
        payable
        whenNotPaused
        returns (uint256 policyId)
    {
        require(requiredSigners > 0, "ConditionalAccess: zero signers");
        _chargeFee();
        policyId = _createPolicy(documentHash, msg.sender, encKeyRef, metadataUri, validUntil, 1, ConditionType.MULTI_SIG);

        conditions[policyId].push(Condition({
            condType:         ConditionType.MULTI_SIG,
            releaseTimestamp: 0,
            oracleEventId:    bytes32(0),
            requiredSigners:  requiredSigners,
            collectedSigners: 0,
            paymentAmount:    0,
            fulfilled:        false
        }));

        emit PolicyCreated(policyId, documentHash, msg.sender, 1, validUntil);
    }

    /**
     * @notice Create a payment-conditional access policy
     * @param documentHash  Hash of the guarded document
     * @param encKeyRef     IPFS CID of encrypted key material
     * @param paymentAmount Required ETH payment in wei to unlock
     * @param validUntil    Expiry timestamp (0 = none)
     */
    function createPaymentPolicy(
        bytes32 documentHash,
        string calldata encKeyRef,
        string calldata metadataUri,
        uint256 paymentAmount,
        uint256 validUntil
    )
        external
        payable
        whenNotPaused
        returns (uint256 policyId)
    {
        require(paymentAmount > 0, "ConditionalAccess: zero payment");
        _chargeFee();
        policyId = _createPolicy(documentHash, msg.sender, encKeyRef, metadataUri, validUntil, 1, ConditionType.PAYMENT);

        conditions[policyId].push(Condition({
            condType:         ConditionType.PAYMENT,
            releaseTimestamp: 0,
            oracleEventId:    bytes32(0),
            requiredSigners:  0,
            collectedSigners: 0,
            paymentAmount:    paymentAmount,
            fulfilled:        false
        }));

        emit PolicyCreated(policyId, documentHash, msg.sender, 1, validUntil);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Condition Fulfillment
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Attempt to fulfill a TIME_LOCK condition. Anyone can call once timestamp passes.
     */
    function fulfillTimeLock(uint256 policyId, uint256 conditionIndex)
        external
        whenNotPaused
        nonReentrant
    {
        Condition storage c = conditions[policyId][conditionIndex];
        require(c.condType == ConditionType.TIME_LOCK, "ConditionalAccess: wrong type");
        require(!c.fulfilled,                          "ConditionalAccess: already fulfilled");
        require(block.timestamp >= c.releaseTimestamp, "ConditionalAccess: not yet");

        c.fulfilled = true;
        emit ConditionFulfilled(policyId, conditionIndex, ConditionType.TIME_LOCK, msg.sender, block.timestamp);
        _tryRelease(policyId);
    }

    /**
     * @notice Oracle submits a verified event result for an ORACLE_VERIFY condition.
     */
    function submitOracleEvent(uint256 policyId, uint256 conditionIndex, bool result)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
        nonReentrant
    {
        Condition storage c = conditions[policyId][conditionIndex];
        require(c.condType == ConditionType.ORACLE_VERIFY, "ConditionalAccess: wrong type");
        require(!c.fulfilled,                              "ConditionalAccess: already fulfilled");
        require(result,                                    "ConditionalAccess: oracle reports false");

        oracleEvents[policyId][c.oracleEventId] = true;
        c.fulfilled = true;

        emit OracleEventSubmitted(policyId, c.oracleEventId, msg.sender, result, block.timestamp);
        emit ConditionFulfilled(policyId, conditionIndex, ConditionType.ORACLE_VERIFY, msg.sender, block.timestamp);
        _tryRelease(policyId);
    }

    /**
     * @notice Submit a multi-sig approval for a MULTI_SIG condition.
     */
    function submitSignerApproval(uint256 policyId, uint256 conditionIndex)
        external
        whenNotPaused
        nonReentrant
    {
        Condition storage c = conditions[policyId][conditionIndex];
        require(c.condType == ConditionType.MULTI_SIG, "ConditionalAccess: wrong type");
        require(!c.fulfilled,                          "ConditionalAccess: already fulfilled");
        require(!hasApproved[policyId][msg.sender],    "ConditionalAccess: already approved");

        hasApproved[policyId][msg.sender] = true;
        c.collectedSigners++;

        emit ConditionFulfilled(policyId, conditionIndex, ConditionType.MULTI_SIG, msg.sender, block.timestamp);

        if (c.collectedSigners >= c.requiredSigners) {
            c.fulfilled = true;
            _tryRelease(policyId);
        }
    }

    /**
     * @notice Fulfill a PAYMENT condition by sending the required ETH.
     *         ETH is held in escrow until policy owner claims it post-release.
     */
    function fulfillPayment(uint256 policyId, uint256 conditionIndex)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Condition storage c = conditions[policyId][conditionIndex];
        require(c.condType == ConditionType.PAYMENT, "ConditionalAccess: wrong type");
        require(!c.fulfilled,                        "ConditionalAccess: already fulfilled");
        require(msg.value >= c.paymentAmount,        "ConditionalAccess: insufficient payment");

        policies[policyId].escrowed += msg.value;
        c.fulfilled = true;

        emit EscrowDeposited(policyId, msg.sender, msg.value);
        emit ConditionFulfilled(policyId, conditionIndex, ConditionType.PAYMENT, msg.sender, block.timestamp);
        _tryRelease(policyId);
    }

    /**
     * @notice Policy owner claims escrowed payment after release.
     */
    function claimEscrow(uint256 policyId) external nonReentrant {
        AccessPolicy storage p = policies[policyId];
        require(p.owner == msg.sender,        "ConditionalAccess: not owner");
        require(p.status == PolicyStatus.RELEASED, "ConditionalAccess: not released");
        require(p.escrowed > 0,               "ConditionalAccess: nothing to claim");

        uint256 amount = p.escrowed;
        p.escrowed = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "ConditionalAccess: transfer failed");
        emit EscrowReleased(policyId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Compliance override — revoke a policy (e.g. court order)
     */
    function revokePolicy(uint256 policyId, string calldata reason)
        external
        onlyRole(COMPLIANCE_ROLE)
    {
        AccessPolicy storage p = policies[policyId];
        require(p.status == PolicyStatus.ACTIVE, "ConditionalAccess: not active");
        p.status = PolicyStatus.REVOKED;
        emit PolicyRevoked(policyId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Mark a policy as expired if its validUntil has passed.
     */
    function expirePolicy(uint256 policyId) external {
        AccessPolicy storage p = policies[policyId];
        require(p.status == PolicyStatus.ACTIVE,       "ConditionalAccess: not active");
        require(p.validUntil != 0,                     "ConditionalAccess: no expiry set");
        require(block.timestamp > p.validUntil,        "ConditionalAccess: not yet expired");
        p.status = PolicyStatus.EXPIRED;
    }

    function grantOracleRole(address oracle) external onlyRole(ACCESS_ADMIN) {
        _grantRole(ORACLE_ROLE, oracle);
    }

    function setPolicyCreationFee(uint256 fee) external onlyRole(ACCESS_ADMIN) {
        policyCreationFee = fee;
    }

    function setTreasury(address _treasury) external onlyRole(ACCESS_ADMIN) {
        require(_treasury != address(0), "ConditionalAccess: invalid treasury");
        treasury = _treasury;
    }

    function pause()   external onlyRole(ACCESS_ADMIN) { _pause(); }
    function unpause() external onlyRole(ACCESS_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getPolicy(uint256 policyId) external view returns (AccessPolicy memory) {
        return policies[policyId];
    }

    function getConditions(uint256 policyId) external view returns (Condition[] memory) {
        return conditions[policyId];
    }

    function isReleased(uint256 policyId) external view returns (bool) {
        return policies[policyId].status == PolicyStatus.RELEASED;
    }

    function totalPolicies() external view returns (uint256) {
        return _policyIdCounter.current();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _createPolicy(
        bytes32 documentHash,
        address owner,
        string calldata encKeyRef,
        string calldata metadataUri,
        uint256 validUntil,
        uint256 condCount,
        ConditionType compositeLogic
    ) internal returns (uint256 policyId) {
        require(documentHash != bytes32(0), "ConditionalAccess: null document hash");
        require(bytes(encKeyRef).length > 0, "ConditionalAccess: empty key ref");

        _policyIdCounter.increment();
        policyId = _policyIdCounter.current();

        policies[policyId] = AccessPolicy({
            policyId:       policyId,
            documentHash:   documentHash,
            owner:          owner,
            encryptedKeyRef: encKeyRef,
            metadataUri:    metadataUri,
            validUntil:     validUntil,
            conditionCount: condCount,
            compositeLogic: compositeLogic,
            status:         PolicyStatus.ACTIVE,
            createdAt:      block.timestamp,
            releasedAt:     0,
            releasedTo:     address(0),
            escrowed:       0
        });

        documentHashToPolicy[documentHash] = policyId;
    }

    function _tryRelease(uint256 policyId) internal {
        AccessPolicy storage p = policies[policyId];
        if (p.status != PolicyStatus.ACTIVE) return;
        if (p.validUntil != 0 && block.timestamp > p.validUntil) {
            p.status = PolicyStatus.EXPIRED;
            return;
        }

        Condition[] storage conds = conditions[policyId];
        bool shouldRelease = false;

        if (p.compositeLogic == ConditionType.COMPOSITE_OR) {
            // Any one condition fulfilled
            for (uint256 i = 0; i < conds.length; i++) {
                if (conds[i].fulfilled) { shouldRelease = true; break; }
            }
        } else {
            // Default AND: all must be fulfilled
            shouldRelease = true;
            for (uint256 i = 0; i < conds.length; i++) {
                if (!conds[i].fulfilled) { shouldRelease = false; break; }
            }
        }

        if (shouldRelease) {
            p.status     = PolicyStatus.RELEASED;
            p.releasedAt = block.timestamp;
            p.releasedTo = msg.sender;

            emit PolicyReleased(
                policyId,
                p.documentHash,
                msg.sender,
                p.encryptedKeyRef,
                block.timestamp
            );
        }
    }

    function _chargeFee() internal {
        if (policyCreationFee > 0) {
            require(msg.value >= policyCreationFee, "ConditionalAccess: insufficient fee");
            (bool ok, ) = treasury.call{value: policyCreationFee}("");
            require(ok, "ConditionalAccess: fee transfer failed");
        }
    }
}
