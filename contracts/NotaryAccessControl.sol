// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    NotaryAccessControl.sol
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
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title NotaryAccessControl
 * @author AI Autonomous Notary Protocol
 * @notice Centralized role-based access control with multi-signature enforcement
 *         for all critical administrative operations across the protocol.
 * @dev Extends OpenZeppelin AccessControl with:
 *      - Multi-sig requirement for privileged role changes
 *      - Time-locked administrative actions (48-hour delay)
 *      - Per-role guardian overrides for emergency response
 *      - On-chain audit trail for every role mutation
 */
contract NotaryAccessControl is AccessControl, Pausable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ─────────────────────────────────────────────────────────────────────────
    // Constants & Roles
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant TIMELOCK_DELAY         = 48 hours;
    uint256 public constant MIN_MULTISIG_THRESHOLD = 2;
    uint256 public constant MAX_MULTISIG_SIGNERS   = 10;

    bytes32 public constant SUPER_ADMIN_ROLE    = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant NOTARY_ROLE         = keccak256("NOTARY_ROLE");
    bytes32 public constant VALIDATOR_ROLE      = keccak256("VALIDATOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE     = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant TREASURY_ROLE       = keccak256("TREASURY_ROLE");
    bytes32 public constant OPERATOR_ROLE       = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE       = keccak256("GUARDIAN_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct PendingAction {
        bytes32   actionId;
        address   proposer;
        address   target;
        bytes32   role;
        bool      isGrant;       // true = grant, false = revoke
        uint256   proposedAt;
        uint256   executableAt;  // proposedAt + TIMELOCK_DELAY
        bool      executed;
        bool      cancelled;
        uint256   signatureCount;
        mapping(address => bool) signed;
    }

    struct RoleInfo {
        string  name;
        uint256 memberCount;
        bool    requiresMultiSig;
        uint256 multiSigThreshold;
    }

    struct AuditRecord {
        bytes32 role;
        address account;
        address actor;
        uint256 timestamp;
        string  action;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    // role => member set
    mapping(bytes32 => EnumerableSet.AddressSet) private _roleMembers;

    // role => RoleInfo metadata
    mapping(bytes32 => RoleInfo) public roleInfo;

    // actionId => PendingAction
    mapping(bytes32 => PendingAction) private _pendingActions;

    // actionId[] in order proposed
    bytes32[] public pendingActionIds;

    // Multi-sig signer set (separate from role membership)
    EnumerableSet.AddressSet private _multiSigSigners;
    uint256 public multiSigThreshold;

    AuditRecord[] private _auditLog;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ActionProposed(
        bytes32 indexed actionId,
        address indexed proposer,
        address indexed target,
        bytes32 role,
        bool isGrant,
        uint256 executableAt
    );

    event ActionSigned(bytes32 indexed actionId, address indexed signer, uint256 signatureCount);
    event ActionExecuted(bytes32 indexed actionId, address indexed executor);
    event ActionCancelled(bytes32 indexed actionId, address indexed canceller);

    event MultiSigSignerAdded(address indexed signer);
    event MultiSigSignerRemoved(address indexed signer);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    event RoleAudit(
        bytes32 indexed role,
        address indexed account,
        address indexed actor,
        string action,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address[] memory initialAdmins, uint256 threshold) {
        require(initialAdmins.length >= threshold,          "AccessControl: insufficient admins for threshold");
        require(threshold >= MIN_MULTISIG_THRESHOLD,        "AccessControl: threshold too low");
        require(initialAdmins.length <= MAX_MULTISIG_SIGNERS, "AccessControl: too many signers");

        multiSigThreshold = threshold;

        for (uint256 i = 0; i < initialAdmins.length; i++) {
            require(initialAdmins[i] != address(0), "AccessControl: zero address signer");
            _grantRole(DEFAULT_ADMIN_ROLE, initialAdmins[i]);
            _grantRole(SUPER_ADMIN_ROLE,   initialAdmins[i]);
            _grantRole(GUARDIAN_ROLE,      initialAdmins[i]);
            _multiSigSigners.add(initialAdmins[i]);
            _roleMembers[DEFAULT_ADMIN_ROLE].add(initialAdmins[i]);
            _roleMembers[SUPER_ADMIN_ROLE].add(initialAdmins[i]);
        }

        // Initialize role metadata
        _initRoleInfo(SUPER_ADMIN_ROLE,   "SUPER_ADMIN",   true,  threshold);
        _initRoleInfo(NOTARY_ROLE,        "NOTARY",        true,  MIN_MULTISIG_THRESHOLD);
        _initRoleInfo(VALIDATOR_ROLE,     "VALIDATOR",     false, 1);
        _initRoleInfo(COMPLIANCE_ROLE,    "COMPLIANCE",    true,  MIN_MULTISIG_THRESHOLD);
        _initRoleInfo(TREASURY_ROLE,      "TREASURY",      true,  threshold);
        _initRoleInfo(OPERATOR_ROLE,      "OPERATOR",      false, 1);
        _initRoleInfo(GUARDIAN_ROLE,      "GUARDIAN",      false, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Multi-Sig Timelock Actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Propose granting or revoking a role (enters timelock queue)
     * @param target   Address to grant/revoke role on
     * @param role     Role bytes32 identifier
     * @param isGrant  true = grant, false = revoke
     * @return actionId Unique action identifier
     */
    function proposeRoleChange(address target, bytes32 role, bool isGrant)
        external
        onlyRole(SUPER_ADMIN_ROLE)
        whenNotPaused
        returns (bytes32 actionId)
    {
        require(target != address(0), "AccessControl: zero target");
        actionId = keccak256(abi.encodePacked(target, role, isGrant, block.timestamp, msg.sender));

        PendingAction storage action = _pendingActions[actionId];
        action.actionId        = actionId;
        action.proposer        = msg.sender;
        action.target          = target;
        action.role            = role;
        action.isGrant         = isGrant;
        action.proposedAt      = block.timestamp;
        action.executableAt    = block.timestamp + TIMELOCK_DELAY;
        action.signatureCount  = 1;
        action.signed[msg.sender] = true;

        pendingActionIds.push(actionId);

        emit ActionProposed(actionId, msg.sender, target, role, isGrant, block.timestamp + TIMELOCK_DELAY);
        emit ActionSigned(actionId, msg.sender, 1);
    }

    /**
     * @notice Sign an already-proposed role change action
     */
    function signAction(bytes32 actionId) external onlyMultiSigSigner whenNotPaused {
        PendingAction storage action = _pendingActions[actionId];
        require(!action.executed,             "AccessControl: already executed");
        require(!action.cancelled,            "AccessControl: cancelled");
        require(!action.signed[msg.sender],   "AccessControl: already signed");

        action.signed[msg.sender] = true;
        action.signatureCount++;

        emit ActionSigned(actionId, msg.sender, action.signatureCount);
    }

    /**
     * @notice Execute a role change after timelock and sufficient signatures
     */
    function executeAction(bytes32 actionId) external onlyRole(SUPER_ADMIN_ROLE) whenNotPaused {
        PendingAction storage action = _pendingActions[actionId];
        require(!action.executed,                      "AccessControl: already executed");
        require(!action.cancelled,                     "AccessControl: cancelled");
        require(block.timestamp >= action.executableAt, "AccessControl: timelock active");
        require(action.signatureCount >= multiSigThreshold, "AccessControl: insufficient signatures");

        action.executed = true;

        if (action.isGrant) {
            _grantRole(action.role, action.target);
            _roleMembers[action.role].add(action.target);
        } else {
            _revokeRole(action.role, action.target);
            _roleMembers[action.role].remove(action.target);
        }

        string memory actionStr = action.isGrant ? "ROLE_GRANTED" : "ROLE_REVOKED";
        _audit(action.role, action.target, msg.sender, actionStr);
        emit ActionExecuted(actionId, msg.sender);
    }

    /**
     * @notice Cancel a pending action (guardian or proposer only within 24h)
     */
    function cancelAction(bytes32 actionId) external {
        PendingAction storage action = _pendingActions[actionId];
        require(!action.executed,  "AccessControl: already executed");
        require(!action.cancelled, "AccessControl: already cancelled");
        require(
            msg.sender == action.proposer || hasRole(GUARDIAN_ROLE, msg.sender),
            "AccessControl: unauthorized canceller"
        );

        action.cancelled = true;
        emit ActionCancelled(actionId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Instant Role Management (for non-sensitive roles or emergencies)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Grant an operator role instantly (no timelock for low-privilege roles)
     */
    function grantOperatorRole(address account) external onlyRole(SUPER_ADMIN_ROLE) whenNotPaused {
        require(!roleInfo[OPERATOR_ROLE].requiresMultiSig, "AccessControl: role requires multi-sig");
        _grantRole(OPERATOR_ROLE, account);
        _roleMembers[OPERATOR_ROLE].add(account);
        _audit(OPERATOR_ROLE, account, msg.sender, "ROLE_GRANTED");
    }

    function revokeOperatorRole(address account) external onlyRole(SUPER_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, account);
        _roleMembers[OPERATOR_ROLE].remove(account);
        _audit(OPERATOR_ROLE, account, msg.sender, "ROLE_REVOKED");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Multi-Sig Signer Management
    // ─────────────────────────────────────────────────────────────────────────

    function addMultiSigSigner(address signer) external onlyRole(SUPER_ADMIN_ROLE) {
        require(signer != address(0),                       "AccessControl: zero signer");
        require(!_multiSigSigners.contains(signer),         "AccessControl: already a signer");
        require(_multiSigSigners.length() < MAX_MULTISIG_SIGNERS, "AccessControl: max signers reached");
        _multiSigSigners.add(signer);
        emit MultiSigSignerAdded(signer);
    }

    function removeMultiSigSigner(address signer) external onlyRole(SUPER_ADMIN_ROLE) {
        require(_multiSigSigners.contains(signer), "AccessControl: not a signer");
        require(_multiSigSigners.length() - 1 >= multiSigThreshold, "AccessControl: would break threshold");
        _multiSigSigners.remove(signer);
        emit MultiSigSignerRemoved(signer);
    }

    function updateThreshold(uint256 newThreshold) external onlyRole(SUPER_ADMIN_ROLE) {
        require(newThreshold >= MIN_MULTISIG_THRESHOLD,          "AccessControl: threshold too low");
        require(newThreshold <= _multiSigSigners.length(),        "AccessControl: threshold exceeds signers");
        uint256 old = multiSigThreshold;
        multiSigThreshold = newThreshold;
        emit ThresholdUpdated(old, newThreshold);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getRoleMembers(bytes32 role) external view returns (address[] memory) {
        uint256 len = _roleMembers[role].length();
        address[] memory members = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            members[i] = _roleMembers[role].at(i);
        }
        return members;
    }

    function getMultiSigSigners() external view returns (address[] memory) {
        uint256 len = _multiSigSigners.length();
        address[] memory signers = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            signers[i] = _multiSigSigners.at(i);
        }
        return signers;
    }

    function isMultiSigSigner(address account) external view returns (bool) {
        return _multiSigSigners.contains(account);
    }

    function getPendingAction(bytes32 actionId) external view returns (
        address proposer, address target, bytes32 role, bool isGrant,
        uint256 executableAt, bool executed, bool cancelled, uint256 signatureCount
    ) {
        PendingAction storage a = _pendingActions[actionId];
        return (a.proposer, a.target, a.role, a.isGrant, a.executableAt, a.executed, a.cancelled, a.signatureCount);
    }

    function hasSigned(bytes32 actionId, address signer) external view returns (bool) {
        return _pendingActions[actionId].signed[signer];
    }

    function getAuditLog() external view onlyRole(SUPER_ADMIN_ROLE) returns (AuditRecord[] memory) {
        return _auditLog;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(GUARDIAN_ROLE) { _pause(); }
    function unpause() external onlyRole(SUPER_ADMIN_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers & Internals
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyMultiSigSigner() {
        require(_multiSigSigners.contains(msg.sender), "AccessControl: not a multi-sig signer");
        _;
    }

    function _initRoleInfo(
        bytes32 role,
        string memory name,
        bool requiresMultiSig,
        uint256 threshold
    ) private {
        roleInfo[role] = RoleInfo({
            name:               name,
            memberCount:        0,
            requiresMultiSig:   requiresMultiSig,
            multiSigThreshold:  threshold
        });
    }

    function _audit(bytes32 role, address account, address actor, string memory action) internal {
        _auditLog.push(AuditRecord({
            role:      role,
            account:   account,
            actor:     actor,
            timestamp: block.timestamp,
            action:    action
        }));
        emit RoleAudit(role, account, actor, action, block.timestamp);
    }
}
