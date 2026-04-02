// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    NotaryToken.sol
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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title NotaryToken
 * @author AI Autonomous Notary Protocol
 * @notice Fixed-supply $NOTARY governance and utility token.
 *         100,000,000 tokens, deflationary via burn, ERC-20Votes for DAO.
 *
 * @dev Distribution (per tokenomics doc):
 *   - 15% Seed investors (15M)   → 2-year vesting with 6-month cliff
 *   - 20% Team & advisors (20M)  → 4-year vesting with 1-year cliff
 *   - 25% Treasury/DAO (25M)     → time-locked, DAO governed
 *   - 20% Ecosystem rewards (20M)→ emissions contract
 *   - 10% Liquidity (10M)        → DEX bootstrapping
 *   - 10% Reserve (10M)          → strategic ops
 *
 *   Vesting and emissions are handled by separate contracts that receive
 *   allocations at deployment; this contract holds only the token logic.
 */
contract NotaryToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, AccessControl, Pausable {
    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 1e18; // 100 M $NOTARY

    bytes32 public constant MINTER_ROLE    = keccak256("MINTER_ROLE");
    bytes32 public constant TOKEN_ADMIN    = keccak256("TOKEN_ADMIN");

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AllocationMinted(address indexed recipient, uint256 amount, string label);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param admin         Protocol admin (multi-sig)
     * @param treasury      Treasury contract — receives 25M
     * @param ecosystem     Ecosystem rewards contract — receives 20M
     * @param liquidity     Liquidity bootstrapping address — receives 10M
     * @param reserve       Reserve address — receives 10M
     * @param teamVesting   Team vesting contract — receives 20M
     * @param investorVesting Investor vesting contract — receives 15M
     */
    constructor(
        address admin,
        address treasury,
        address ecosystem,
        address liquidity,
        address reserve,
        address teamVesting,
        address investorVesting
    )
        ERC20("Notary Token", "NOTARY")
        ERC20Permit("Notary Token")
    {
        require(admin          != address(0), "NotaryToken: zero admin");
        require(treasury       != address(0), "NotaryToken: zero treasury");
        require(ecosystem      != address(0), "NotaryToken: zero ecosystem");
        require(liquidity      != address(0), "NotaryToken: zero liquidity");
        require(reserve        != address(0), "NotaryToken: zero reserve");
        require(teamVesting    != address(0), "NotaryToken: zero team vesting");
        require(investorVesting != address(0),"NotaryToken: zero investor vesting");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TOKEN_ADMIN,        admin);

        // Mint fixed supply to allocations
        _mintAllocation(treasury,        25_000_000 * 1e18, "Treasury/DAO");
        _mintAllocation(ecosystem,       20_000_000 * 1e18, "Ecosystem Rewards");
        _mintAllocation(teamVesting,     20_000_000 * 1e18, "Team & Advisors Vesting");
        _mintAllocation(investorVesting, 15_000_000 * 1e18, "Investor Vesting");
        _mintAllocation(liquidity,       10_000_000 * 1e18, "Liquidity Bootstrapping");
        _mintAllocation(reserve,         10_000_000 * 1e18, "Strategic Reserve");

        require(totalSupply() == TOTAL_SUPPLY, "NotaryToken: supply mismatch");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-20Votes overrides (required)
    // ─────────────────────────────────────────────────────────────────────────

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pausable
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(TOKEN_ADMIN) { _pause(); }
    function unpause() external onlyRole(TOKEN_ADMIN) { _unpause(); }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _mintAllocation(address to, uint256 amount, string memory label) internal {
        _mint(to, amount);
        emit AllocationMinted(to, amount, label);
    }
}
