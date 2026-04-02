// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    Treasury.sol
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
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Treasury
 * @author AI Autonomous Notary Protocol
 * @notice Protocol treasury holding ETH and ERC-20 tokens (including $NOTARY).
 *         Governed by Governance.sol in hybrid mode — spending proposals must
 *         be approved by the admin council during Phase 2.
 *
 * @dev Revenue flows in from:
 *   - DocumentMarketplace.sol (trade fees)
 *   - AMM.sol (protocol fee sweep)
 *   - LendingProtocol.sol (interest fees)
 *   - AuctionHouse.sol (auction fees)
 *   - NotaryNFT.sol (royalties via ERC-2981)
 *
 *   Spending is controlled by multi-sig + timelock:
 *   - Spends up to `smallSpendLimit` require TREASURER_ROLE (no timelock)
 *   - Larger spends require a queued + confirmed spending request
 */
contract Treasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant TREASURY_ADMIN    = keccak256("TREASURY_ADMIN");
    bytes32 public constant TREASURER_ROLE    = keccak256("TREASURER_ROLE");
    bytes32 public constant SPEND_APPROVER    = keccak256("SPEND_APPROVER");
    bytes32 public constant REVENUE_DEPOSITOR = keccak256("REVENUE_DEPOSITOR");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant TIMELOCK_DELAY = 48 hours;

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct SpendRequest {
        uint256  requestId;
        address  recipient;
        address  token;          // address(0) = ETH
        uint256  amount;
        string   purpose;
        string   ipfsCid;        // Supporting documentation
        uint256  requestedAt;
        uint256  executableAfter; // requestedAt + TIMELOCK_DELAY
        bool     executed;
        bool     cancelled;
        uint256  approvalCount;
        mapping(address => bool) approved;
    }

    struct RevenueEntry {
        address source;
        address token;           // address(0) = ETH
        uint256 amount;
        uint256 receivedAt;
        string  category;        // e.g. "marketplace_fee", "auction_fee"
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _requestIdCounter;
    Counters.Counter private _revenueIdCounter;

    uint256 public smallSpendLimit;   // ETH amount below which no timelock needed
    uint256 public requiredApprovals; // Multi-sig threshold for large spends

    mapping(uint256 => SpendRequest) public spendRequests;
    mapping(uint256 => RevenueEntry) public revenueLog;

    // Accumulated totals per token
    mapping(address => uint256) public totalReceived;  // token → cumulative received
    mapping(address => uint256) public totalSpent;     // token → cumulative spent

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event RevenueReceived(
        uint256 indexed revenueId,
        address indexed source,
        address token,
        uint256 amount,
        string category
    );

    event SpendRequested(
        uint256 indexed requestId,
        address indexed recipient,
        address token,
        uint256 amount,
        string purpose
    );

    event SpendApproved(uint256 indexed requestId, address indexed approver, uint256 count);
    event SpendExecuted(uint256 indexed requestId, address indexed recipient, uint256 amount);
    event SpendCancelled(uint256 indexed requestId);

    event SmallSpend(address indexed recipient, address token, uint256 amount, string purpose);
    event ParameterUpdated(string param, uint256 newValue);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address admin,
        uint256 _smallSpendLimit,
        uint256 _requiredApprovals
    ) {
        require(admin             != address(0), "Treasury: zero admin");
        require(_requiredApprovals >= 2,         "Treasury: min 2 approvals");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ADMIN,     admin);
        _grantRole(TREASURER_ROLE,     admin);
        _grantRole(SPEND_APPROVER,     admin);

        smallSpendLimit   = _smallSpendLimit;
        requiredApprovals = _requiredApprovals;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revenue Reception
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Log ETH revenue received from a protocol contract.
     *         Callable by REVENUE_DEPOSITOR role (marketplace, AMM, etc.)
     */
    function logRevenue(address source, string calldata category)
        external payable nonReentrant whenNotPaused onlyRole(REVENUE_DEPOSITOR)
    {
        require(msg.value > 0, "Treasury: zero value");
        _logEntry(source, address(0), msg.value, category);
    }

    /**
     * @notice Log ERC-20 revenue received from a protocol contract.
     */
    function logTokenRevenue(
        address source,
        address token,
        uint256 amount,
        string calldata category
    ) external nonReentrant whenNotPaused onlyRole(REVENUE_DEPOSITOR) {
        require(token  != address(0), "Treasury: zero token");
        require(amount > 0,           "Treasury: zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _logEntry(source, token, amount, category);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Small Spend (no timelock, TREASURER_ROLE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Spend ETH from treasury without timelock.
     *         Amount must not exceed `smallSpendLimit`.
     */
    function smallSpendEth(
        address payable recipient,
        uint256         amount,
        string calldata purpose
    ) external nonReentrant whenNotPaused onlyRole(TREASURER_ROLE) {
        require(recipient != address(0), "Treasury: zero recipient");
        require(amount > 0,              "Treasury: zero amount");
        require(amount <= smallSpendLimit, "Treasury: exceeds small spend limit");
        require(address(this).balance >= amount, "Treasury: insufficient ETH");

        totalSpent[address(0)] += amount;
        (bool ok, ) = recipient.call{value: amount}("");
        require(ok, "Treasury: ETH transfer failed");

        emit SmallSpend(recipient, address(0), amount, purpose);
    }

    /**
     * @notice Spend ERC-20 tokens from treasury without timelock.
     */
    function smallSpendToken(
        address token,
        address recipient,
        uint256 amount,
        string calldata purpose
    ) external nonReentrant whenNotPaused onlyRole(TREASURER_ROLE) {
        require(token     != address(0), "Treasury: zero token");
        require(recipient != address(0), "Treasury: zero recipient");
        require(amount    > 0,           "Treasury: zero amount");
        require(amount    <= smallSpendLimit, "Treasury: exceeds small spend limit");

        totalSpent[token] += amount;
        IERC20(token).safeTransfer(recipient, amount);

        emit SmallSpend(recipient, token, amount, purpose);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Large Spend (timelock + multi-sig)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Queue a large spend request for multi-sig approval.
     */
    function requestSpend(
        address        recipient,
        address        token,     // address(0) = ETH
        uint256        amount,
        string calldata purpose,
        string calldata ipfsCid
    ) external nonReentrant onlyRole(TREASURER_ROLE) returns (uint256 requestId) {
        require(recipient != address(0), "Treasury: zero recipient");
        require(amount    > 0,           "Treasury: zero amount");
        require(amount    > smallSpendLimit, "Treasury: use smallSpend");

        _requestIdCounter.increment();
        requestId = _requestIdCounter.current();

        SpendRequest storage r = spendRequests[requestId];
        r.requestId      = requestId;
        r.recipient      = recipient;
        r.token          = token;
        r.amount         = amount;
        r.purpose        = purpose;
        r.ipfsCid        = ipfsCid;
        r.requestedAt    = block.timestamp;
        r.executableAfter = block.timestamp + TIMELOCK_DELAY;

        emit SpendRequested(requestId, recipient, token, amount, purpose);
    }

    /**
     * @notice Approve a queued spend request.
     */
    function approveSpend(uint256 requestId) external onlyRole(SPEND_APPROVER) {
        SpendRequest storage r = spendRequests[requestId];
        require(r.requestId != 0,   "Treasury: not found");
        require(!r.executed,        "Treasury: already executed");
        require(!r.cancelled,       "Treasury: cancelled");
        require(!r.approved[msg.sender], "Treasury: already approved");

        r.approved[msg.sender] = true;
        r.approvalCount++;

        emit SpendApproved(requestId, msg.sender, r.approvalCount);
    }

    /**
     * @notice Execute an approved, timelocked spend request.
     */
    function executeSpend(uint256 requestId) external nonReentrant onlyRole(TREASURY_ADMIN) {
        SpendRequest storage r = spendRequests[requestId];
        require(r.requestId != 0,                             "Treasury: not found");
        require(!r.executed,                                  "Treasury: already executed");
        require(!r.cancelled,                                 "Treasury: cancelled");
        require(r.approvalCount >= requiredApprovals,         "Treasury: insufficient approvals");
        require(block.timestamp >= r.executableAfter,         "Treasury: timelock active");

        r.executed = true;
        totalSpent[r.token] += r.amount;

        if (r.token == address(0)) {
            require(address(this).balance >= r.amount, "Treasury: insufficient ETH");
            (bool ok, ) = r.recipient.call{value: r.amount}("");
            require(ok, "Treasury: ETH transfer failed");
        } else {
            IERC20(r.token).safeTransfer(r.recipient, r.amount);
        }

        emit SpendExecuted(requestId, r.recipient, r.amount);
    }

    /**
     * @notice Cancel a queued spend request.
     */
    function cancelSpend(uint256 requestId) external onlyRole(TREASURY_ADMIN) {
        SpendRequest storage r = spendRequests[requestId];
        require(!r.executed,  "Treasury: already executed");
        require(!r.cancelled, "Treasury: already cancelled");
        r.cancelled = true;
        emit SpendCancelled(requestId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function ethBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function tokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getSpendRequest(uint256 requestId) external view returns (
        uint256 id, address recipient, address token, uint256 amount,
        string memory purpose, bool executed, bool cancelled,
        uint256 approvalCount, uint256 executableAfter
    ) {
        SpendRequest storage r = spendRequests[requestId];
        return (r.requestId, r.recipient, r.token, r.amount, r.purpose,
                r.executed, r.cancelled, r.approvalCount, r.executableAfter);
    }

    function getRevenueEntry(uint256 revenueId) external view returns (RevenueEntry memory) {
        return revenueLog[revenueId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setSmallSpendLimit(uint256 limit) external onlyRole(TREASURY_ADMIN) {
        emit ParameterUpdated("smallSpendLimit", limit);
        smallSpendLimit = limit;
    }

    function setRequiredApprovals(uint256 count) external onlyRole(TREASURY_ADMIN) {
        require(count >= 2, "Treasury: min 2");
        emit ParameterUpdated("requiredApprovals", count);
        requiredApprovals = count;
    }

    function pause()   external onlyRole(TREASURY_ADMIN) { _pause(); }
    function unpause() external onlyRole(TREASURY_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _logEntry(address source, address token, uint256 amount, string memory category) internal {
        _revenueIdCounter.increment();
        uint256 id = _revenueIdCounter.current();
        revenueLog[id] = RevenueEntry({
            source:     source,
            token:      token,
            amount:     amount,
            receivedAt: block.timestamp,
            category:   category
        });
        totalReceived[token] += amount;
        emit RevenueReceived(id, source, token, amount, category);
    }

    receive() external payable {
        // Accept ETH deposits without role restriction (e.g. auction proceeds)
        totalReceived[address(0)] += msg.value;
    }
}
