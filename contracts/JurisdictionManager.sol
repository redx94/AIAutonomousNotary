// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    JurisdictionManager.sol
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
 * @title JurisdictionManager
 * @author AI Autonomous Notary Protocol
 * @notice On-chain registry of approved jurisdiction rules.
 *         Bridges the off-chain PolicyEngine.js (overlay) with on-chain
 *         enforcement, enabling DAO-governed rule submission and approval.
 *
 * @dev Jurisdiction rules contain a content hash (IPFS CID of the full rule JSON)
 *      that the off-chain PolicyEngine resolves. This contract tracks:
 *      - Rule proposals (any qualified notary can propose)
 *      - DAO approval / rejection (Governance.sol votes for rule changes)
 *      - Active rule set per jurisdiction code
 *      - Rule deprecation and versioning
 *
 *      US-first: Initial supported jurisdictions are US general and US states.
 *      Framework supports EU, UK, UAE, and others via same interface.
 */
contract JurisdictionManager is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant JURISDICTION_ADMIN = keccak256("JURISDICTION_ADMIN");
    bytes32 public constant RULE_PROPOSER      = keccak256("RULE_PROPOSER");
    bytes32 public constant RULE_APPROVER      = keccak256("RULE_APPROVER"); // DAO / governance

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum RuleStatus { PROPOSED, ACTIVE, DEPRECATED, REJECTED }
    enum LegalMode  { COMPLIANT, EXPERIMENTAL }
    enum AuthorityType { HUMAN_COMMISSIONED, AUTONOMOUS }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct JurisdictionRule {
        uint256       ruleId;
        string        jurisdictionCode; // ISO 3166-1 (e.g. "US", "US-CA", "EU", "GB")
        string        ruleKey;          // Unique key (e.g. "us-general-compliant-notarization")
        string        ipfsCid;          // IPFS CID of full rule JSON (off-chain content)
        bytes32       contentHash;      // Keccak of the rule JSON for integrity
        LegalMode     legalMode;
        AuthorityType authorityType;
        uint256       version;          // Incremented on rule update
        uint256       proposedAt;
        uint256       activatedAt;
        uint256       deprecatedAt;
        address       proposer;
        RuleStatus    status;
        uint256       maxRiskScore;     // 0-100
        bool          requiresHumanSupervision;
        uint256       retentionYears;
    }

    struct JurisdictionInfo {
        string  code;           // ISO 3166-1
        string  name;           // Human-readable name
        bool    supported;
        uint256 activeRuleCount;
        uint256 addedAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _ruleIdCounter;

    mapping(uint256 => JurisdictionRule) public rules;        // ruleId → rule
    mapping(string  => JurisdictionInfo) public jurisdictions; // code → info
    // jurisdictionCode → array of ruleIds
    mapping(string  => uint256[]) public jurisdictionRules;
    // jurisdictionCode → active rule ID (latest activated rule)
    mapping(string  => mapping(string => uint256)) public activeRuleByKey; // code+key → ruleId

    string[] public supportedJurisdictions;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event JurisdictionAdded(string indexed code, string name);
    event JurisdictionRemoved(string indexed code);

    event RuleProposed(
        uint256 indexed ruleId,
        string  indexed jurisdictionCode,
        string  ruleKey,
        address indexed proposer,
        string  ipfsCid
    );

    event RuleActivated(uint256 indexed ruleId, string indexed jurisdictionCode, string ruleKey);
    event RuleDeprecated(uint256 indexed ruleId, uint256 supersededBy);
    event RuleRejected(uint256 indexed ruleId, string reason);

    event ContentHashVerified(uint256 indexed ruleId, bytes32 contentHash);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address governance) {
        require(admin      != address(0), "JurisdictionManager: zero admin");
        require(governance != address(0), "JurisdictionManager: zero governance");

        _grantRole(DEFAULT_ADMIN_ROLE,  admin);
        _grantRole(JURISDICTION_ADMIN,  admin);
        _grantRole(RULE_PROPOSER,       admin);
        _grantRole(RULE_APPROVER,       governance); // Governance.sol executes approvals

        // Seed US jurisdiction
        _addJurisdiction("US",    "United States");
        _addJurisdiction("US-CA", "California");
        _addJurisdiction("US-NY", "New York");
        _addJurisdiction("US-TX", "Texas");
        _addJurisdiction("US-FL", "Florida");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Jurisdiction Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Add a new jurisdiction to the supported set.
     */
    function addJurisdiction(string calldata code, string calldata name)
        external onlyRole(JURISDICTION_ADMIN)
    {
        require(!jurisdictions[code].supported, "JurisdictionManager: already exists");
        _addJurisdiction(code, name);
    }

    /**
     * @notice Remove a jurisdiction (marks as unsupported, preserves history).
     */
    function removeJurisdiction(string calldata code) external onlyRole(JURISDICTION_ADMIN) {
        require(jurisdictions[code].supported, "JurisdictionManager: not found");
        jurisdictions[code].supported = false;
        emit JurisdictionRemoved(code);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rule Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Propose a new jurisdiction rule.
     *         Full rule JSON is stored off-chain (IPFS); only the content hash and
     *         key metadata are anchored here.
     * @param jurisdictionCode ISO 3166-1 code (must be a supported jurisdiction)
     * @param ruleKey          Unique key matching PolicyEngine policy ID
     * @param ipfsCid          IPFS CID of the full rule JSON
     * @param contentHash      Keccak256 of the rule JSON (integrity check)
     * @param legalMode        COMPLIANT or EXPERIMENTAL
     * @param authorityType    HUMAN_COMMISSIONED or AUTONOMOUS
     * @param maxRiskScore     Maximum allowed risk score (0-100)
     * @param requiresHuman    Whether human supervision is required
     * @param retentionYears   Mandatory retention period in years
     */
    function proposeRule(
        string calldata jurisdictionCode,
        string calldata ruleKey,
        string calldata ipfsCid,
        bytes32         contentHash,
        LegalMode       legalMode,
        AuthorityType   authorityType,
        uint256         maxRiskScore,
        bool            requiresHuman,
        uint256         retentionYears
    ) external onlyRole(RULE_PROPOSER) returns (uint256 ruleId) {
        require(jurisdictions[jurisdictionCode].supported, "JurisdictionManager: jurisdiction not supported");
        require(contentHash != bytes32(0), "JurisdictionManager: zero hash");
        require(maxRiskScore <= 100,       "JurisdictionManager: risk > 100");
        require(retentionYears > 0,        "JurisdictionManager: zero retention");

        // Determine version (increment if rule key already exists)
        uint256 existingId = activeRuleByKey[jurisdictionCode][ruleKey];
        uint256 version    = existingId == 0 ? 1 : rules[existingId].version + 1;

        _ruleIdCounter.increment();
        ruleId = _ruleIdCounter.current();

        rules[ruleId] = JurisdictionRule({
            ruleId:                 ruleId,
            jurisdictionCode:       jurisdictionCode,
            ruleKey:                ruleKey,
            ipfsCid:                ipfsCid,
            contentHash:            contentHash,
            legalMode:              legalMode,
            authorityType:          authorityType,
            version:                version,
            proposedAt:             block.timestamp,
            activatedAt:            0,
            deprecatedAt:           0,
            proposer:               msg.sender,
            status:                 RuleStatus.PROPOSED,
            maxRiskScore:           maxRiskScore,
            requiresHumanSupervision: requiresHuman,
            retentionYears:         retentionYears
        });

        jurisdictionRules[jurisdictionCode].push(ruleId);

        emit RuleProposed(ruleId, jurisdictionCode, ruleKey, msg.sender, ipfsCid);
    }

    /**
     * @notice Activate a proposed rule. Called by Governance.sol after DAO approval
     *         (or by JURISDICTION_ADMIN in Phase 2 hybrid mode).
     *         Deprecates the previous active rule for the same key.
     */
    function activateRule(uint256 ruleId) external onlyRole(RULE_APPROVER) {
        JurisdictionRule storage rule = _requireProposedRule(ruleId);

        // Deprecate previous active rule for this key
        uint256 previousId = activeRuleByKey[rule.jurisdictionCode][rule.ruleKey];
        if (previousId != 0 && rules[previousId].status == RuleStatus.ACTIVE) {
            rules[previousId].status       = RuleStatus.DEPRECATED;
            rules[previousId].deprecatedAt = block.timestamp;
            emit RuleDeprecated(previousId, ruleId);
        }

        rule.status      = RuleStatus.ACTIVE;
        rule.activatedAt = block.timestamp;
        activeRuleByKey[rule.jurisdictionCode][rule.ruleKey] = ruleId;
        jurisdictions[rule.jurisdictionCode].activeRuleCount++;

        emit RuleActivated(ruleId, rule.jurisdictionCode, rule.ruleKey);
    }

    /**
     * @notice Reject a proposed rule (e.g. did not pass DAO vote).
     */
    function rejectRule(uint256 ruleId, string calldata reason)
        external onlyRole(RULE_APPROVER)
    {
        JurisdictionRule storage rule = _requireProposedRule(ruleId);
        rule.status = RuleStatus.REJECTED;
        emit RuleRejected(ruleId, reason);
    }

    /**
     * @notice Manually deprecate an active rule without a replacement.
     *         Used for emergency rule withdrawal.
     */
    function deprecateRule(uint256 ruleId) external onlyRole(JURISDICTION_ADMIN) {
        JurisdictionRule storage rule = rules[ruleId];
        require(rule.ruleId != 0,               "JurisdictionManager: not found");
        require(rule.status == RuleStatus.ACTIVE, "JurisdictionManager: not active");
        rule.status       = RuleStatus.DEPRECATED;
        rule.deprecatedAt = block.timestamp;
        if (activeRuleByKey[rule.jurisdictionCode][rule.ruleKey] == ruleId) {
            activeRuleByKey[rule.jurisdictionCode][rule.ruleKey] = 0;
        }
        emit RuleDeprecated(ruleId, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Content Verification
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify that provided rule JSON matches the stored content hash.
     *         Called off-chain by PolicyEngine after fetching IPFS content.
     */
    function verifyContent(uint256 ruleId, bytes calldata ruleJson) external {
        JurisdictionRule storage rule = rules[ruleId];
        require(rule.ruleId != 0, "JurisdictionManager: not found");
        bytes32 computed = keccak256(ruleJson);
        require(computed == rule.contentHash, "JurisdictionManager: content mismatch");
        emit ContentHashVerified(ruleId, computed);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getRule(uint256 ruleId) external view returns (JurisdictionRule memory) {
        return rules[ruleId];
    }

    function getActiveRule(string calldata jurisdictionCode, string calldata ruleKey)
        external view returns (JurisdictionRule memory)
    {
        uint256 id = activeRuleByKey[jurisdictionCode][ruleKey];
        require(id != 0, "JurisdictionManager: no active rule");
        return rules[id];
    }

    function getJurisdictionRules(string calldata code) external view returns (uint256[] memory) {
        return jurisdictionRules[code];
    }

    function isJurisdictionSupported(string calldata code) external view returns (bool) {
        return jurisdictions[code].supported;
    }

    function getSupportedJurisdictions() external view returns (string[] memory) {
        return supportedJurisdictions;
    }

    function getJurisdiction(string calldata code) external view returns (JurisdictionInfo memory) {
        return jurisdictions[code];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Role Management
    // ─────────────────────────────────────────────────────────────────────────

    function grantProposer(address account) external onlyRole(JURISDICTION_ADMIN) {
        _grantRole(RULE_PROPOSER, account);
    }

    function revokeProposer(address account) external onlyRole(JURISDICTION_ADMIN) {
        _revokeRole(RULE_PROPOSER, account);
    }

    function pause()   external onlyRole(JURISDICTION_ADMIN) { _pause(); }
    function unpause() external onlyRole(JURISDICTION_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _addJurisdiction(string memory code, string memory name) internal {
        jurisdictions[code] = JurisdictionInfo({
            code:            code,
            name:            name,
            supported:       true,
            activeRuleCount: 0,
            addedAt:         block.timestamp
        });
        supportedJurisdictions.push(code);
        emit JurisdictionAdded(code, name);
    }

    function _requireProposedRule(uint256 ruleId) internal view returns (JurisdictionRule storage rule) {
        rule = rules[ruleId];
        require(rule.ruleId != 0,                  "JurisdictionManager: not found");
        require(rule.status == RuleStatus.PROPOSED, "JurisdictionManager: not proposed");
    }
}
