// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 Reece Dixon - All Rights Reserved.
// This file is part of AI Autonomous Notary.
// Unauthorized copying, modification, or commercial use of this file,
// via any medium, is strictly prohibited until the Change Date.

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title EmergencyProtocol
 * @author AI Autonomous Notary Protocol
 * @notice Protocol-wide circuit breaker and emergency response system.
 *         Provides graduated response levels from soft pause to full lockdown,
 *         with automatic cooldown timers and multi-contract coordination.
 * @dev Any registered contract in the ecosystem can query emergency state.
 *      Guardian addresses can trigger individual-level emergencies.
 *      Only SUPER_ADMIN with multi-sig can escalate to LEVEL_3 (full lockdown).
 */
contract EmergencyProtocol is AccessControl, Pausable {

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE    = keccak256("GUARDIAN_ROLE");
    bytes32 public constant MONITOR_ROLE     = keccak256("MONITOR_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum EmergencyLevel {
        NONE,      // Normal operation
        LEVEL_1,   // Soft pause: high-value transfers suspended
        LEVEL_2,   // Hard pause: all external calls suspended
        LEVEL_3    // Full lockdown: all protocol activity suspended
    }

    enum EmergencyType {
        SECURITY_BREACH,
        ORACLE_FAILURE,
        MARKET_MANIPULATION,
        REGULATORY_ACTION,
        CONTRACT_BUG,
        EXTERNAL_ATTACK,
        MANUAL_OVERRIDE
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct EmergencyEvent {
        uint256       eventId;
        EmergencyLevel level;
        EmergencyType  emergencyType;
        address        triggeredBy;
        uint256        triggeredAt;
        uint256        resolvedAt;
        bool           resolved;
        string         description;
        bytes32        evidenceHash;  // Hash of off-chain evidence
    }

    struct CircuitBreaker {
        address contractAddress;
        string  name;
        bool    isActive;
        bool    isPaused;
        uint256 pausedAt;
        uint256 autoResumeAt;  // 0 = manual resume required
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    EmergencyLevel public currentLevel = EmergencyLevel.NONE;
    uint256        public eventCounter;
    uint256        public constant COOLDOWN_PERIOD = 24 hours;
    uint256        public cooldownEnd;

    mapping(uint256 => EmergencyEvent) public emergencyEvents;
    mapping(address => CircuitBreaker) public circuitBreakers;
    address[]                          public registeredContracts;

    // Per-level thresholds
    mapping(EmergencyLevel => uint256) public maxTransferAmount;

    // Incident counters for automated escalation
    uint256 public incidentCount;
    uint256 public constant AUTO_ESCALATION_THRESHOLD = 3;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event EmergencyTriggered(
        uint256 indexed eventId,
        EmergencyLevel indexed level,
        EmergencyType  indexed emergencyType,
        address triggeredBy,
        string  description,
        uint256 timestamp
    );

    event EmergencyEscalated(
        uint256 indexed eventId,
        EmergencyLevel oldLevel,
        EmergencyLevel newLevel,
        address escalatedBy,
        uint256 timestamp
    );

    event EmergencyResolved(
        uint256 indexed eventId,
        address indexed resolvedBy,
        uint256 timestamp
    );

    event CircuitBreakerRegistered(address indexed contractAddress, string name);
    event CircuitBreakerTripped(address indexed contractAddress, uint256 autoResumeAt);
    event CircuitBreakerReset(address indexed contractAddress, address indexed resetBy);

    event IncidentRecorded(uint256 incidentCount, uint256 threshold);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address[] memory guardians) {
        require(admin != address(0), "Emergency: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SUPER_ADMIN_ROLE,   admin);
        _grantRole(GUARDIAN_ROLE,      admin);

        for (uint256 i = 0; i < guardians.length; i++) {
            require(guardians[i] != address(0), "Emergency: zero guardian");
            _grantRole(GUARDIAN_ROLE, guardians[i]);
        }

        // Set default transfer caps per level
        maxTransferAmount[EmergencyLevel.NONE]    = type(uint256).max;
        maxTransferAmount[EmergencyLevel.LEVEL_1] = 10_000 ether;
        maxTransferAmount[EmergencyLevel.LEVEL_2] = 0;
        maxTransferAmount[EmergencyLevel.LEVEL_3] = 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Emergency Triggers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Trigger a Level 1 emergency (soft pause)
     * @dev Callable by guardians; does NOT pause the contract itself.
     *      Sets level and coordinates circuit breakers.
     */
    function triggerLevel1(
        EmergencyType emergencyType,
        string calldata description,
        bytes32 evidenceHash
    )
        external
        onlyRole(GUARDIAN_ROLE)
        returns (uint256 eventId)
    {
        require(
            currentLevel == EmergencyLevel.NONE,
            "Emergency: already in emergency state"
        );
        eventId = _createEvent(EmergencyLevel.LEVEL_1, emergencyType, description, evidenceHash);
        currentLevel = EmergencyLevel.LEVEL_1;
        _tripAllCircuitBreakers(6 hours);
    }

    /**
     * @notice Trigger a Level 2 emergency (hard pause)
     */
    function triggerLevel2(
        EmergencyType emergencyType,
        string calldata description,
        bytes32 evidenceHash
    )
        external
        onlyRole(GUARDIAN_ROLE)
        returns (uint256 eventId)
    {
        require(currentLevel != EmergencyLevel.LEVEL_3, "Emergency: already at max level");
        eventId = _createEvent(EmergencyLevel.LEVEL_2, emergencyType, description, evidenceHash);

        EmergencyLevel oldLevel = currentLevel;
        currentLevel = EmergencyLevel.LEVEL_2;
        _pause();
        _tripAllCircuitBreakers(0); // Manual resume required

        emit EmergencyEscalated(eventId, oldLevel, EmergencyLevel.LEVEL_2, msg.sender, block.timestamp);
    }

    /**
     * @notice Trigger a Level 3 full lockdown (SUPER_ADMIN only)
     */
    function triggerLevel3(
        EmergencyType emergencyType,
        string calldata description,
        bytes32 evidenceHash
    )
        external
        onlyRole(SUPER_ADMIN_ROLE)
        returns (uint256 eventId)
    {
        eventId = _createEvent(EmergencyLevel.LEVEL_3, emergencyType, description, evidenceHash);

        EmergencyLevel oldLevel = currentLevel;
        currentLevel = EmergencyLevel.LEVEL_3;
        if (!paused()) _pause();
        _tripAllCircuitBreakers(0);

        emit EmergencyEscalated(eventId, oldLevel, EmergencyLevel.LEVEL_3, msg.sender, block.timestamp);
    }

    /**
     * @notice Resolve the current emergency and restore normal operations
     * @param eventId       The emergency event to resolve
     * @param setLevel      Target level after resolution
     */
    function resolveEmergency(uint256 eventId, EmergencyLevel setLevel)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(currentLevel != EmergencyLevel.NONE,      "Emergency: no active emergency");
        require(!emergencyEvents[eventId].resolved,       "Emergency: event already resolved");
        require(uint8(setLevel) < uint8(currentLevel),    "Emergency: can only de-escalate");

        emergencyEvents[eventId].resolved   = true;
        emergencyEvents[eventId].resolvedAt = block.timestamp;

        EmergencyLevel oldLevel = currentLevel;
        currentLevel = setLevel;

        if (setLevel == EmergencyLevel.NONE) {
            if (paused()) _unpause();
            cooldownEnd  = block.timestamp + COOLDOWN_PERIOD;
            incidentCount = 0;
        }

        emit EmergencyResolved(eventId, msg.sender, block.timestamp);
        emit EmergencyEscalated(eventId, oldLevel, setLevel, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Circuit Breakers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a protocol contract for coordinated circuit breaking
     */
    function registerContract(address contractAddress, string calldata name)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        require(contractAddress != address(0), "Emergency: zero address");
        require(!circuitBreakers[contractAddress].isActive, "Emergency: already registered");

        circuitBreakers[contractAddress] = CircuitBreaker({
            contractAddress: contractAddress,
            name:            name,
            isActive:        true,
            isPaused:        false,
            pausedAt:        0,
            autoResumeAt:    0
        });
        registeredContracts.push(contractAddress);
        emit CircuitBreakerRegistered(contractAddress, name);
    }

    /**
     * @notice Manually trip circuit breaker for a single contract
     * @param contractAddress Target contract
     * @param autoResumeDelta Seconds until auto-resume; 0 = manual
     */
    function tripCircuitBreaker(address contractAddress, uint256 autoResumeDelta)
        external
        onlyRole(GUARDIAN_ROLE)
    {
        CircuitBreaker storage cb = circuitBreakers[contractAddress];
        require(cb.isActive,    "Emergency: not registered");
        require(!cb.isPaused,   "Emergency: already paused");

        cb.isPaused     = true;
        cb.pausedAt     = block.timestamp;
        cb.autoResumeAt = autoResumeDelta > 0 ? block.timestamp + autoResumeDelta : 0;

        emit CircuitBreakerTripped(contractAddress, cb.autoResumeAt);
    }

    /**
     * @notice Reset a circuit breaker (manual resume)
     */
    function resetCircuitBreaker(address contractAddress) external onlyRole(GUARDIAN_ROLE) {
        CircuitBreaker storage cb = circuitBreakers[contractAddress];
        require(cb.isActive,  "Emergency: not registered");
        require(cb.isPaused,  "Emergency: not paused");

        cb.isPaused     = false;
        cb.pausedAt     = 0;
        cb.autoResumeAt = 0;

        emit CircuitBreakerReset(contractAddress, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Incident Recording (for auto-escalation logic)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record an incident (callable by registered monitor contracts)
     * @dev Auto-escalates to Level 1 if threshold exceeded during cooldown
     */
    function recordIncident() external onlyRole(MONITOR_ROLE) {
        incidentCount++;
        emit IncidentRecorded(incidentCount, AUTO_ESCALATION_THRESHOLD);

        if (
            incidentCount >= AUTO_ESCALATION_THRESHOLD &&
            currentLevel == EmergencyLevel.NONE &&
            block.timestamp > cooldownEnd
        ) {
            // Auto-trigger Level 1
            _createEvent(
                EmergencyLevel.LEVEL_1,
                EmergencyType.SECURITY_BREACH,
                "Auto-escalation: incident threshold exceeded",
                bytes32(0)
            );
            currentLevel = EmergencyLevel.LEVEL_1;
            _tripAllCircuitBreakers(6 hours);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function isProtocolPaused() external view returns (bool) {
        return paused() || currentLevel >= EmergencyLevel.LEVEL_2;
    }

    function isContractPaused(address contractAddress) external view returns (bool) {
        CircuitBreaker storage cb = circuitBreakers[contractAddress];
        if (!cb.isActive || !cb.isPaused) return false;
        // Auto-resume check
        if (cb.autoResumeAt != 0 && block.timestamp >= cb.autoResumeAt) return false;
        return true;
    }

    function getTransferLimit() external view returns (uint256) {
        return maxTransferAmount[currentLevel];
    }

    function getEmergencyEvent(uint256 eventId)
        external
        view
        returns (EmergencyEvent memory)
    {
        return emergencyEvents[eventId];
    }

    function getRegisteredContracts() external view returns (address[] memory) {
        return registeredContracts;
    }

    function getCircuitBreaker(address contractAddress)
        external
        view
        returns (CircuitBreaker memory)
    {
        return circuitBreakers[contractAddress];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setTransferLimit(EmergencyLevel level, uint256 limit)
        external
        onlyRole(SUPER_ADMIN_ROLE)
    {
        maxTransferAmount[level] = limit;
    }

    function pause()   external onlyRole(GUARDIAN_ROLE) { _pause(); }
    function unpause() external onlyRole(SUPER_ADMIN_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _createEvent(
        EmergencyLevel level,
        EmergencyType emergencyType,
        string memory description,
        bytes32 evidenceHash
    ) internal returns (uint256 eventId) {
        eventCounter++;
        eventId = eventCounter;
        emergencyEvents[eventId] = EmergencyEvent({
            eventId:       eventId,
            level:         level,
            emergencyType: emergencyType,
            triggeredBy:   msg.sender,
            triggeredAt:   block.timestamp,
            resolvedAt:    0,
            resolved:      false,
            description:   description,
            evidenceHash:  evidenceHash
        });
        emit EmergencyTriggered(eventId, level, emergencyType, msg.sender, description, block.timestamp);
    }

    function _tripAllCircuitBreakers(uint256 autoResumeDelta) internal {
        for (uint256 i = 0; i < registeredContracts.length; i++) {
            CircuitBreaker storage cb = circuitBreakers[registeredContracts[i]];
            if (cb.isActive && !cb.isPaused) {
                cb.isPaused     = true;
                cb.pausedAt     = block.timestamp;
                cb.autoResumeAt = autoResumeDelta > 0 ? block.timestamp + autoResumeDelta : 0;
                emit CircuitBreakerTripped(registeredContracts[i], cb.autoResumeAt);
            }
        }
    }
}
