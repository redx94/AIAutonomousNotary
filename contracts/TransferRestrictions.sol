// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    TransferRestrictions.sol
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

/**
 * @title TransferRestrictions
 * @author AI Autonomous Notary Protocol
 * @notice Regulatory transfer restriction engine for document security tokens.
 *         Enforces Regulation D, Regulation S, and Regulation A+ restrictions
 *         on security token transfers. Consumed by DocumentSecurityToken and
 *         FractionalizationVault via a `isTransferAllowed` compliance check.
 *
 * @dev Restriction types enforced:
 *   - **Reg D lockup**: 12-month holding period for non-accredited purchasers
 *   - **Reg S**: Non-US investor offshore period (6 months) with flow-back restrictions
 *   - **Reg A+**: Transfer allowed after 6-month initial holding period
 *   - **KYC re-verification**: Credentials expire and must be refreshed on transfer
 *   - **Investor cap**: Maximum number of record holders per offering
 *   - **Bad actor disqualification**: SEC Rule 506(d) disqualification events
 */
contract TransferRestrictions is AccessControl, Pausable {
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant COMPLIANCE_ADMIN = keccak256("COMPLIANCE_ADMIN");
    bytes32 public constant TRANSFER_AGENT   = keccak256("TRANSFER_AGENT");
    bytes32 public constant KYC_ORACLE       = keccak256("KYC_ORACLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant REG_D_LOCKUP     = 365 days;  // 12-month Reg D holding
    uint256 public constant REG_S_LOCKUP     = 180 days;  // 6-month Reg S offshore
    uint256 public constant REG_A_LOCKUP     = 180 days;  // 6-month Reg A+ initial hold
    uint256 public constant KYC_VALIDITY     = 730 days;  // KYC credential validity (2 years)

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum OfferingType   { REG_D, REG_S, REG_A_PLUS, UNRESTRICTED }
    enum InvestorRegion { US, OFFSHORE, UNKNOWN }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct InvestorProfile {
        bool            kycApproved;
        uint256         kycExpiry;          // Timestamp when KYC credentials expire
        bool            accredited;         // US accredited investor (Rule 501)
        bool            qualifiedPurchaser; // Section 3(c)(7) status
        InvestorRegion  region;
        bool            disqualified;       // Rule 506(d) bad actor
        uint256         profileUpdatedAt;
    }

    struct TokenOffering {
        address       tokenAddress;         // Security token contract
        OfferingType  offeringType;
        uint256       offeringDate;         // When the offering closed
        uint256       maxInvestors;         // 2000 for Reg D (Rule 506)
        uint256       currentInvestors;
        bool          active;
    }

    struct HoldingRecord {
        address tokenAddress;
        address investor;
        uint256 purchasedAt;               // Timestamp of first acquisition
        uint256 lockupEnd;                 // Calculated lock-up expiry
        OfferingType offeringType;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    mapping(address => InvestorProfile) public investorProfiles;

    // tokenAddress → offering details
    mapping(address => TokenOffering) public offerings;

    // (tokenAddress, investor) → holding record
    mapping(address => mapping(address => HoldingRecord)) public holdings;

    // (tokenAddress, investor) → whether investor is on this token's cap table
    mapping(address => mapping(address => bool)) public onCapTable;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event InvestorProfileUpdated(address indexed investor, bool kyc, bool accredited);
    event InvestorDisqualified(address indexed investor, string reason);
    event OfferingRegistered(address indexed tokenAddress, OfferingType offeringType);
    event HoldingRecorded(address indexed investor, address indexed token, uint256 lockupEnd);
    event TransferAllowed(address indexed from, address indexed to, address indexed token);
    event TransferBlocked(address indexed from, address indexed to, address indexed token, string reason);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin) {
        require(admin != address(0), "TransferRestrictions: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE,  admin);
        _grantRole(COMPLIANCE_ADMIN,    admin);
        _grantRole(TRANSFER_AGENT,      admin);
        _grantRole(KYC_ORACLE,          admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Offering Registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a security token offering with its regulatory type.
     * @param tokenAddress  The security token contract address
     * @param offeringType  Regulatory offering type (REG_D, REG_S, REG_A_PLUS)
     * @param maxInvestors  Maximum number of record holders (Reg D: 2000)
     */
    function registerOffering(
        address     tokenAddress,
        OfferingType offeringType,
        uint256     maxInvestors
    ) external onlyRole(COMPLIANCE_ADMIN) {
        require(tokenAddress != address(0), "TransferRestrictions: zero address");
        require(!offerings[tokenAddress].active, "TransferRestrictions: already registered");
        if (offeringType == OfferingType.REG_D) {
            require(maxInvestors <= 2000, "TransferRestrictions: Reg D cap is 2000");
        }

        offerings[tokenAddress] = TokenOffering({
            tokenAddress:     tokenAddress,
            offeringType:     offeringType,
            offeringDate:     block.timestamp,
            maxInvestors:     maxInvestors,
            currentInvestors: 0,
            active:           true
        });

        emit OfferingRegistered(tokenAddress, offeringType);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KYC / Investor Profile
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Set or update an investor's KYC and accreditation status.
     *         Called by off-chain KYC provider (KYC_ORACLE role).
     */
    function updateInvestorProfile(
        address        investor,
        bool           kycApproved,
        bool           accredited,
        bool           qualifiedPurchaser,
        InvestorRegion region
    ) external onlyRole(KYC_ORACLE) {
        require(investor != address(0), "TransferRestrictions: zero address");
        investorProfiles[investor] = InvestorProfile({
            kycApproved:       kycApproved,
            kycExpiry:         block.timestamp + KYC_VALIDITY,
            accredited:        accredited,
            qualifiedPurchaser: qualifiedPurchaser,
            region:            region,
            disqualified:      investorProfiles[investor].disqualified,
            profileUpdatedAt:  block.timestamp
        });
        emit InvestorProfileUpdated(investor, kycApproved, accredited);
    }

    /**
     * @notice Disqualify an investor under Rule 506(d) (bad actor).
     */
    function disqualifyInvestor(address investor, string calldata reason)
        external onlyRole(COMPLIANCE_ADMIN)
    {
        investorProfiles[investor].disqualified = true;
        emit InvestorDisqualified(investor, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Holding Records
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record a new token acquisition and calculate lock-up expiry.
     *         Called by the token contract on mint/transfer-in to a new holder.
     */
    function recordHolding(
        address tokenAddress,
        address investor
    ) external onlyRole(TRANSFER_AGENT) {
        TokenOffering storage offering = offerings[tokenAddress];
        require(offering.active, "TransferRestrictions: offering not registered");

        HoldingRecord storage h = holdings[tokenAddress][investor];
        if (h.purchasedAt == 0) {
            // New holder — add to cap table
            if (!onCapTable[tokenAddress][investor]) {
                require(
                    offering.currentInvestors < offering.maxInvestors,
                    "TransferRestrictions: investor cap reached"
                );
                offering.currentInvestors++;
                onCapTable[tokenAddress][investor] = true;
            }

            uint256 lockupDuration = _lockupFor(offering.offeringType);
            h.tokenAddress   = tokenAddress;
            h.investor       = investor;
            h.purchasedAt    = block.timestamp;
            h.lockupEnd      = block.timestamp + lockupDuration;
            h.offeringType   = offering.offeringType;

            emit HoldingRecorded(investor, tokenAddress, h.lockupEnd);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transfer Compliance Check
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Primary compliance check — called before any token transfer.
     * @return allowed  Whether the transfer is permitted
     * @return reason   Human-readable reason if blocked
     */
    function isTransferAllowed(
        address tokenAddress,
        address from,
        address to,
        uint256 /*amount*/
    ) external returns (bool allowed, string memory reason) {
        // Skip checks for minting (from == address(0))
        if (from == address(0)) {
            _emitAllowed(from, to, tokenAddress);
            return (true, "");
        }

        InvestorProfile storage fromProfile = investorProfiles[from];
        InvestorProfile storage toProfile   = investorProfiles[to];
        HoldingRecord   storage fromHolding = holdings[tokenAddress][from];
        TokenOffering   storage offering    = offerings[tokenAddress];

        // 1. Bad actor check
        if (fromProfile.disqualified || toProfile.disqualified) {
            emit TransferBlocked(from, to, tokenAddress, "bad_actor_disqualification");
            return (false, "bad_actor_disqualification");
        }

        // 2. KYC validity check for recipient
        if (!toProfile.kycApproved || block.timestamp > toProfile.kycExpiry) {
            emit TransferBlocked(from, to, tokenAddress, "recipient_kyc_invalid");
            return (false, "recipient_kyc_invalid");
        }

        if (!offering.active) {
            emit TransferBlocked(from, to, tokenAddress, "offering_not_registered");
            return (false, "offering_not_registered");
        }

        // 3. Lock-up period check
        if (fromHolding.purchasedAt > 0 && block.timestamp < fromHolding.lockupEnd) {
            // Reg D: only permit transfers to other accredited investors
            if (offering.offeringType == OfferingType.REG_D && !toProfile.accredited) {
                emit TransferBlocked(from, to, tokenAddress, "reg_d_lockup_non_accredited");
                return (false, "reg_d_lockup_non_accredited");
            }
            // Reg S: no flow-back to US investors during offshore period
            if (offering.offeringType == OfferingType.REG_S && toProfile.region == InvestorRegion.US) {
                emit TransferBlocked(from, to, tokenAddress, "reg_s_flowback_restriction");
                return (false, "reg_s_flowback_restriction");
            }
        }

        // 4. Investor cap check for new holders
        if (!onCapTable[tokenAddress][to]) {
            if (offering.currentInvestors >= offering.maxInvestors) {
                emit TransferBlocked(from, to, tokenAddress, "investor_cap_reached");
                return (false, "investor_cap_reached");
            }
        }

        _emitAllowed(from, to, tokenAddress);
        return (true, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getInvestorProfile(address investor) external view returns (InvestorProfile memory) {
        return investorProfiles[investor];
    }

    function getHolding(address tokenAddress, address investor)
        external view returns (HoldingRecord memory)
    {
        return holdings[tokenAddress][investor];
    }

    function getOffering(address tokenAddress) external view returns (TokenOffering memory) {
        return offerings[tokenAddress];
    }

    function isKycValid(address investor) external view returns (bool) {
        InvestorProfile storage p = investorProfiles[investor];
        return p.kycApproved && block.timestamp <= p.kycExpiry && !p.disqualified;
    }

    function isLockupExpired(address tokenAddress, address investor) external view returns (bool) {
        HoldingRecord storage h = holdings[tokenAddress][investor];
        return h.purchasedAt == 0 || block.timestamp >= h.lockupEnd;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(COMPLIANCE_ADMIN) { _pause(); }
    function unpause() external onlyRole(COMPLIANCE_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _lockupFor(OfferingType t) internal pure returns (uint256) {
        if (t == OfferingType.REG_D)    return REG_D_LOCKUP;
        if (t == OfferingType.REG_S)    return REG_S_LOCKUP;
        if (t == OfferingType.REG_A_PLUS) return REG_A_LOCKUP;
        return 0;
    }

    function _emitAllowed(address from, address to, address token) internal {
        emit TransferAllowed(from, to, token);
    }
}
