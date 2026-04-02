// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    DocumentMarketplace.sol
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
 * @title DocumentMarketplace
 * @author AI Autonomous Notary Protocol
 * @notice Central limit-order book (CLOB) for trading fractional document shares
 *         issued by FractionalizationVault. Supports both limit and market orders
 *         with on-chain escrow and platform fee routing.
 *
 * @dev Architecture:
 *   - Sellers lock fraction tokens in escrow and post ask orders at a limit price.
 *   - Buyers post bid orders or fill existing asks with ETH.
 *   - Market orders sweep the order book at best available price.
 *   - Platform fee (configurable, max 3%) charged on every fill.
 *   - Fee flows to the protocol Treasury.
 */
contract DocumentMarketplace is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant MARKET_ADMIN = keccak256("MARKET_ADMIN");
    bytes32 public constant FEE_MANAGER  = keccak256("FEE_MANAGER");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant BASIS_POINTS     = 10_000;
    uint256 public constant MAX_FEE_BP       = 300; // 3 %
    uint256 public constant MIN_ORDER_AMOUNT = 1;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum OrderType   { LIMIT, MARKET }
    enum OrderSide   { BID, ASK }
    enum OrderStatus { OPEN, FILLED, CANCELLED, PARTIALLY_FILLED }

    struct Order {
        uint256     orderId;
        address     maker;
        address     shareToken;      // FractionalizationVault ERC-20 address
        OrderSide   side;
        OrderType   orderType;
        OrderStatus status;
        uint256     amount;          // Token amount
        uint256     filled;          // Amount already filled
        uint256     pricePerShare;   // Wei per 1e18 shares (limit orders)
        uint256     createdAt;
        uint256     expiresAt;       // 0 = no expiry
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _orderIdCounter;

    address public treasury;
    uint256 public feeBP; // Platform fee in basis points

    mapping(uint256 => Order) public orders;

    // shareToken → sorted ask order IDs (ascending price)
    mapping(address => uint256[]) private _askQueue;
    // shareToken → sorted bid order IDs (descending price)
    mapping(address => uint256[]) private _bidQueue;

    // user → open order IDs
    mapping(address => uint256[]) public userOrders;

    // Escrowed tokens per order
    mapping(uint256 => uint256) public escrowedTokens;
    // Escrowed ETH per order (bids)
    mapping(uint256 => uint256) public escrowedEth;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        address indexed shareToken,
        OrderSide side,
        OrderType orderType,
        uint256 amount,
        uint256 pricePerShare
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 fillAmount,
        uint256 fillValue,
        uint256 fee
    );

    event OrderCancelled(uint256 indexed orderId, address indexed maker);

    event FeeUpdated(uint256 oldFeeBP, uint256 newFeeBP);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address _treasury, uint256 _feeBP) {
        require(admin     != address(0), "DocumentMarketplace: zero admin");
        require(_treasury != address(0), "DocumentMarketplace: zero treasury");
        require(_feeBP    <= MAX_FEE_BP, "DocumentMarketplace: fee too high");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MARKET_ADMIN,       admin);
        _grantRole(FEE_MANAGER,        admin);

        treasury = _treasury;
        feeBP    = _feeBP;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Order Placement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Post a limit ASK (sell) order.
     *         Caller must approve this contract for `amount` of `shareToken`.
     * @param shareToken    FractionalizationVault ERC-20 address
     * @param amount        Number of fraction tokens to sell
     * @param pricePerShare Price in wei per 1e18 tokens
     * @param expiresAt     Unix timestamp; 0 = no expiry
     */
    function placeLimitAsk(
        address shareToken,
        uint256 amount,
        uint256 pricePerShare,
        uint256 expiresAt
    ) external nonReentrant whenNotPaused returns (uint256 orderId) {
        require(shareToken    != address(0),    "DocumentMarketplace: zero token");
        require(amount        >= MIN_ORDER_AMOUNT, "DocumentMarketplace: zero amount");
        require(pricePerShare > 0,              "DocumentMarketplace: zero price");
        if (expiresAt != 0) require(expiresAt > block.timestamp, "DocumentMarketplace: expired");

        orderId = _nextOrderId();
        orders[orderId] = Order({
            orderId:       orderId,
            maker:         msg.sender,
            shareToken:    shareToken,
            side:          OrderSide.ASK,
            orderType:     OrderType.LIMIT,
            status:        OrderStatus.OPEN,
            amount:        amount,
            filled:        0,
            pricePerShare: pricePerShare,
            createdAt:     block.timestamp,
            expiresAt:     expiresAt
        });

        // Escrow tokens from seller
        IERC20(shareToken).safeTransferFrom(msg.sender, address(this), amount);
        escrowedTokens[orderId] = amount;

        _insertAsk(shareToken, orderId, pricePerShare);
        userOrders[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, shareToken, OrderSide.ASK, OrderType.LIMIT, amount, pricePerShare);
    }

    /**
     * @notice Post a limit BID (buy) order.
     *         Caller sends ETH equal to `amount * pricePerShare / 1e18`.
     * @param shareToken    FractionalizationVault ERC-20 address
     * @param amount        Number of fraction tokens to buy
     * @param pricePerShare Maximum price willing to pay in wei per 1e18 tokens
     * @param expiresAt     Unix timestamp; 0 = no expiry
     */
    function placeLimitBid(
        address shareToken,
        uint256 amount,
        uint256 pricePerShare,
        uint256 expiresAt
    ) external payable nonReentrant whenNotPaused returns (uint256 orderId) {
        require(shareToken    != address(0),    "DocumentMarketplace: zero token");
        require(amount        >= MIN_ORDER_AMOUNT, "DocumentMarketplace: zero amount");
        require(pricePerShare > 0,              "DocumentMarketplace: zero price");
        if (expiresAt != 0) require(expiresAt > block.timestamp, "DocumentMarketplace: expired");

        uint256 requiredEth = (amount * pricePerShare) / 1e18;
        require(msg.value >= requiredEth, "DocumentMarketplace: insufficient ETH");

        orderId = _nextOrderId();
        orders[orderId] = Order({
            orderId:       orderId,
            maker:         msg.sender,
            shareToken:    shareToken,
            side:          OrderSide.BID,
            orderType:     OrderType.LIMIT,
            status:        OrderStatus.OPEN,
            amount:        amount,
            filled:        0,
            pricePerShare: pricePerShare,
            createdAt:     block.timestamp,
            expiresAt:     expiresAt
        });

        escrowedEth[orderId] = msg.value;
        _insertBid(shareToken, orderId, pricePerShare);
        userOrders[msg.sender].push(orderId);

        // Refund excess ETH
        uint256 excess = msg.value - requiredEth;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "DocumentMarketplace: ETH refund failed");
        }

        emit OrderPlaced(orderId, msg.sender, shareToken, OrderSide.BID, OrderType.LIMIT, amount, pricePerShare);
    }

    /**
     * @notice Market buy: fill existing ASK orders at best available price.
     *         Send ETH; any leftover is refunded.
     * @param shareToken FractionalizationVault ERC-20 address
     * @param amount     Number of fraction tokens to purchase
     */
    function marketBuy(
        address shareToken,
        uint256 amount
    ) external payable nonReentrant whenNotPaused {
        require(shareToken != address(0), "DocumentMarketplace: zero token");
        require(amount     >= MIN_ORDER_AMOUNT, "DocumentMarketplace: zero amount");

        uint256 remaining  = amount;
        uint256 ethSpent   = 0;

        uint256[] storage askQueue = _askQueue[shareToken];

        while (remaining > 0 && askQueue.length > 0) {
            uint256 askId  = askQueue[0];
            Order storage ask = orders[askId];

            // Skip stale/expired orders
            if (ask.status != OrderStatus.OPEN || _isExpired(ask)) {
                _removeFirstAsk(shareToken);
                continue;
            }

            uint256 fillable  = ask.amount - ask.filled;
            uint256 fillNow   = remaining < fillable ? remaining : fillable;
            uint256 cost      = (fillNow * ask.pricePerShare) / 1e18;

            require(msg.value >= ethSpent + cost, "DocumentMarketplace: insufficient ETH");

            uint256 fee     = (cost * feeBP) / BASIS_POINTS;
            uint256 sellerGet = cost - fee;

            // Transfer tokens to buyer
            IERC20(shareToken).safeTransfer(msg.sender, fillNow);
            escrowedTokens[askId] -= fillNow;

            // Pay seller
            (bool sellerOk, ) = ask.maker.call{value: sellerGet}("");
            require(sellerOk, "DocumentMarketplace: seller payment failed");

            // Pay fee to treasury
            if (fee > 0) {
                (bool feeOk, ) = treasury.call{value: fee}("");
                require(feeOk, "DocumentMarketplace: fee transfer failed");
            }

            ask.filled += fillNow;
            ethSpent   += cost;
            remaining  -= fillNow;

            emit OrderFilled(askId, msg.sender, fillNow, cost, fee);

            if (ask.filled == ask.amount) {
                ask.status = OrderStatus.FILLED;
                _removeFirstAsk(shareToken);
            } else {
                ask.status = OrderStatus.PARTIALLY_FILLED;
            }
        }

        require(remaining == 0, "DocumentMarketplace: insufficient liquidity");

        // Refund unspent ETH
        uint256 refund = msg.value - ethSpent;
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "DocumentMarketplace: ETH refund failed");
        }
    }

    /**
     * @notice Market sell: fill existing BID orders at best available price.
     *         Caller must approve this contract for `amount` of `shareToken`.
     * @param shareToken FractionalizationVault ERC-20 address
     * @param amount     Number of fraction tokens to sell
     */
    function marketSell(
        address shareToken,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(shareToken != address(0), "DocumentMarketplace: zero token");
        require(amount     >= MIN_ORDER_AMOUNT, "DocumentMarketplace: zero amount");

        uint256 remaining  = amount;
        uint256 ethEarned  = 0;

        IERC20(shareToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256[] storage bidQueue = _bidQueue[shareToken];

        while (remaining > 0 && bidQueue.length > 0) {
            uint256 bidId = bidQueue[0];
            Order storage bid = orders[bidId];

            if (bid.status != OrderStatus.OPEN || _isExpired(bid)) {
                _refundExpiredBid(bidId);
                _removeFirstBid(shareToken);
                continue;
            }

            uint256 fillable = bid.amount - bid.filled;
            uint256 fillNow  = remaining < fillable ? remaining : fillable;
            uint256 proceeds = (fillNow * bid.pricePerShare) / 1e18;

            uint256 fee      = (proceeds * feeBP) / BASIS_POINTS;
            uint256 sellerGet = proceeds - fee;

            // Transfer tokens to buyer (bid maker)
            IERC20(shareToken).safeTransfer(bid.maker, fillNow);

            // Deduct ETH from bid escrow
            escrowedEth[bidId] -= proceeds;

            ethEarned  += sellerGet;
            remaining  -= fillNow;
            bid.filled += fillNow;

            if (fee > 0) {
                (bool feeOk, ) = treasury.call{value: fee}("");
                require(feeOk, "DocumentMarketplace: fee transfer failed");
            }

            emit OrderFilled(bidId, msg.sender, fillNow, proceeds, fee);

            if (bid.filled == bid.amount) {
                bid.status = OrderStatus.FILLED;
                _removeFirstBid(shareToken);
            } else {
                bid.status = OrderStatus.PARTIALLY_FILLED;
            }
        }

        require(remaining == 0, "DocumentMarketplace: insufficient bid liquidity");

        // Return any unsold tokens
        if (remaining > 0) {
            IERC20(shareToken).safeTransfer(msg.sender, remaining);
        }

        // Pay seller
        if (ethEarned > 0) {
            (bool ok, ) = msg.sender.call{value: ethEarned}("");
            require(ok, "DocumentMarketplace: seller payment failed");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Order Cancellation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Cancel an open or partially-filled order. Refunds escrowed assets.
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        require(o.maker == msg.sender, "DocumentMarketplace: not maker");
        require(
            o.status == OrderStatus.OPEN || o.status == OrderStatus.PARTIALLY_FILLED,
            "DocumentMarketplace: not cancellable"
        );

        o.status = OrderStatus.CANCELLED;

        if (o.side == OrderSide.ASK) {
            uint256 remaining = escrowedTokens[orderId];
            escrowedTokens[orderId] = 0;
            if (remaining > 0) {
                IERC20(o.shareToken).safeTransfer(msg.sender, remaining);
            }
        } else {
            uint256 remaining = escrowedEth[orderId];
            escrowedEth[orderId] = 0;
            if (remaining > 0) {
                (bool ok, ) = msg.sender.call{value: remaining}("");
                require(ok, "DocumentMarketplace: ETH refund failed");
            }
        }

        emit OrderCancelled(orderId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setFee(uint256 newFeeBP) external onlyRole(FEE_MANAGER) {
        require(newFeeBP <= MAX_FEE_BP, "DocumentMarketplace: fee too high");
        emit FeeUpdated(feeBP, newFeeBP);
        feeBP = newFeeBP;
    }

    function setTreasury(address newTreasury) external onlyRole(MARKET_ADMIN) {
        require(newTreasury != address(0), "DocumentMarketplace: zero address");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function pause()   external onlyRole(MARKET_ADMIN) { _pause(); }
    function unpause() external onlyRole(MARKET_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getAskQueue(address shareToken) external view returns (uint256[] memory) {
        return _askQueue[shareToken];
    }

    function getBidQueue(address shareToken) external view returns (uint256[] memory) {
        return _bidQueue[shareToken];
    }

    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    function bestAsk(address shareToken) external view returns (uint256 price, uint256 amount) {
        uint256[] storage q = _askQueue[shareToken];
        if (q.length == 0) return (0, 0);
        Order storage o = orders[q[0]];
        return (o.pricePerShare, o.amount - o.filled);
    }

    function bestBid(address shareToken) external view returns (uint256 price, uint256 amount) {
        uint256[] storage q = _bidQueue[shareToken];
        if (q.length == 0) return (0, 0);
        Order storage o = orders[q[0]];
        return (o.pricePerShare, o.amount - o.filled);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _nextOrderId() internal returns (uint256) {
        _orderIdCounter.increment();
        return _orderIdCounter.current();
    }

    function _isExpired(Order storage o) internal view returns (bool) {
        return o.expiresAt != 0 && block.timestamp > o.expiresAt;
    }

    /// @dev Insertion-sort ASK queue ascending by price
    function _insertAsk(address token, uint256 orderId, uint256 price) internal {
        uint256[] storage q = _askQueue[token];
        q.push(orderId);
        uint256 i = q.length - 1;
        while (i > 0 && orders[q[i - 1]].pricePerShare > price) {
            (q[i], q[i - 1]) = (q[i - 1], q[i]);
            unchecked { --i; }
        }
    }

    /// @dev Insertion-sort BID queue descending by price
    function _insertBid(address token, uint256 orderId, uint256 price) internal {
        uint256[] storage q = _bidQueue[token];
        q.push(orderId);
        uint256 i = q.length - 1;
        while (i > 0 && orders[q[i - 1]].pricePerShare < price) {
            (q[i], q[i - 1]) = (q[i - 1], q[i]);
            unchecked { --i; }
        }
    }

    function _removeFirstAsk(address token) internal {
        uint256[] storage q = _askQueue[token];
        if (q.length == 0) return;
        for (uint256 i = 0; i < q.length - 1; i++) q[i] = q[i + 1];
        q.pop();
    }

    function _removeFirstBid(address token) internal {
        uint256[] storage q = _bidQueue[token];
        if (q.length == 0) return;
        for (uint256 i = 0; i < q.length - 1; i++) q[i] = q[i + 1];
        q.pop();
    }

    function _refundExpiredBid(uint256 orderId) internal {
        Order storage o = orders[orderId];
        o.status = OrderStatus.CANCELLED;
        uint256 remaining = escrowedEth[orderId];
        escrowedEth[orderId] = 0;
        if (remaining > 0) {
            (bool ok, ) = o.maker.call{value: remaining}("");
            require(ok, "DocumentMarketplace: refund failed");
        }
    }
}
