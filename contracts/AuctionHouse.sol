// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    AuctionHouse.sol
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
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AuctionHouse
 * @author AI Autonomous Notary Protocol
 * @notice Dual-mode auction engine supporting:
 *   - **Dutch Auction**: Price starts high and decreases linearly over time.
 *     Used for initial vault launches and new document security token offerings.
 *   - **English Auction**: Open bidding where highest bid wins after deadline.
 *     Integrates with FractionalizationVault for secondary NFT buyouts.
 *
 * @dev Supports auctioning both ERC-721 NFTs and ERC-20 share tokens.
 *      All bids are escrowed in the contract; losing bids are refunded.
 */
contract AuctionHouse is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant AUCTION_ADMIN = keccak256("AUCTION_ADMIN");
    bytes32 public constant FEE_MANAGER   = keccak256("FEE_MANAGER");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant BASIS_POINTS   = 10_000;
    uint256 public constant MAX_FEE_BP     = 500;  // 5%
    uint256 public constant MIN_DURATION   = 1 hours;
    uint256 public constant MAX_DURATION   = 30 days;
    uint256 public constant MIN_BID_INCREMENT_BP = 100; // 1% min increment for English

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum AuctionType   { DUTCH, ENGLISH }
    enum AssetType     { ERC721, ERC20 }
    enum AuctionStatus { OPEN, SETTLED, CANCELLED }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Auction {
        uint256       auctionId;
        AuctionType   auctionType;
        AssetType     assetType;
        AuctionStatus status;
        address       seller;
        address       assetToken;   // ERC-721 or ERC-20 contract
        uint256       assetId;      // tokenId for ERC-721; 0 for ERC-20
        uint256       assetAmount;  // token amount for ERC-20; 1 for ERC-721
        // Pricing
        uint256       startPrice;   // Dutch: starting price; English: reserve price
        uint256       endPrice;     // Dutch: floor price; English: 0
        // Timing
        uint256       startTime;
        uint256       endTime;
        // English auction state
        address       highBidder;
        uint256       highBid;
        // Metadata
        string        metadataUri;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _auctionIdCounter;

    address public treasury;
    uint256 public feeBP;

    mapping(uint256 => Auction) public auctions;
    // English: pending refunds for outbid participants
    mapping(uint256 => mapping(address => uint256)) public pendingRefunds;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        AuctionType auctionType,
        AssetType assetType,
        address assetToken,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startTime,
        uint256 endTime
    );

    event DutchPurchase(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 price,
        uint256 fee
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 previousHigh
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPrice,
        uint256 fee
    );

    event AuctionCancelled(uint256 indexed auctionId, address indexed seller);
    event RefundClaimed(uint256 indexed auctionId, address indexed bidder, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address _treasury, uint256 _feeBP) {
        require(admin     != address(0), "AuctionHouse: zero admin");
        require(_treasury != address(0), "AuctionHouse: zero treasury");
        require(_feeBP    <= MAX_FEE_BP, "AuctionHouse: fee too high");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AUCTION_ADMIN,      admin);
        _grantRole(FEE_MANAGER,        admin);

        treasury = _treasury;
        feeBP    = _feeBP;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dutch Auction
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a Dutch auction. Price decreases linearly from `startPrice`
     *         to `endPrice` over the auction duration.
     * @param assetType   ERC721 or ERC20
     * @param assetToken  Contract address of the asset
     * @param assetId     Token ID (ERC-721) or 0 (ERC-20)
     * @param assetAmount Amount of ERC-20 tokens; 1 for ERC-721
     * @param startPrice  Initial price in wei
     * @param endPrice    Floor price in wei (must be < startPrice)
     * @param duration    Auction length in seconds
     * @param metadataUri IPFS URI for auction metadata
     */
    function createDutchAuction(
        AssetType  assetType,
        address    assetToken,
        uint256    assetId,
        uint256    assetAmount,
        uint256    startPrice,
        uint256    endPrice,
        uint256    duration,
        string calldata metadataUri
    ) external nonReentrant whenNotPaused returns (uint256 auctionId) {
        require(assetToken  != address(0), "AuctionHouse: zero asset");
        require(startPrice  > endPrice,    "AuctionHouse: start <= end");
        require(endPrice    > 0,           "AuctionHouse: zero end price");
        require(duration    >= MIN_DURATION && duration <= MAX_DURATION, "AuctionHouse: bad duration");
        require(assetAmount > 0,           "AuctionHouse: zero amount");

        auctionId = _nextAuctionId();
        uint256 start = block.timestamp;
        uint256 end   = start + duration;

        auctions[auctionId] = Auction({
            auctionId:   auctionId,
            auctionType: AuctionType.DUTCH,
            assetType:   assetType,
            status:      AuctionStatus.OPEN,
            seller:      msg.sender,
            assetToken:  assetToken,
            assetId:     assetId,
            assetAmount: assetAmount,
            startPrice:  startPrice,
            endPrice:    endPrice,
            startTime:   start,
            endTime:     end,
            highBidder:  address(0),
            highBid:     0,
            metadataUri: metadataUri
        });

        _escrowAsset(assetType, assetToken, assetId, assetAmount, msg.sender);

        emit AuctionCreated(auctionId, msg.sender, AuctionType.DUTCH, assetType, assetToken, startPrice, endPrice, start, end);
    }

    /**
     * @notice Purchase at current Dutch auction price.
     *         Excess ETH refunded.
     */
    function dutchBuy(uint256 auctionId) external payable nonReentrant whenNotPaused {
        Auction storage a = _requireOpenAuction(auctionId);
        require(a.auctionType == AuctionType.DUTCH, "AuctionHouse: not Dutch");
        require(block.timestamp < a.endTime,        "AuctionHouse: auction ended");

        uint256 currentPrice = dutchCurrentPrice(auctionId);
        require(msg.value >= currentPrice, "AuctionHouse: insufficient ETH");

        a.status    = AuctionStatus.SETTLED;
        a.highBidder = msg.sender;
        a.highBid    = currentPrice;

        _settleAuction(auctionId, msg.sender, currentPrice);

        // Refund excess ETH
        uint256 excess = msg.value - currentPrice;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "AuctionHouse: ETH refund failed");
        }

        emit DutchPurchase(auctionId, msg.sender, currentPrice, (currentPrice * feeBP) / BASIS_POINTS);
    }

    /**
     * @notice Current price of a Dutch auction (linearly decaying).
     */
    function dutchCurrentPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage a = auctions[auctionId];
        require(a.auctionId != 0, "AuctionHouse: not found");
        if (block.timestamp >= a.endTime) return a.endPrice;
        uint256 elapsed   = block.timestamp - a.startTime;
        uint256 duration  = a.endTime - a.startTime;
        uint256 priceDrop = ((a.startPrice - a.endPrice) * elapsed) / duration;
        return a.startPrice - priceDrop;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // English Auction
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create an English auction. Bidding is open until deadline.
     *         Minimum bid is `startPrice` (reserve price).
     */
    function createEnglishAuction(
        AssetType  assetType,
        address    assetToken,
        uint256    assetId,
        uint256    assetAmount,
        uint256    reservePrice,
        uint256    duration,
        string calldata metadataUri
    ) external nonReentrant whenNotPaused returns (uint256 auctionId) {
        require(assetToken  != address(0), "AuctionHouse: zero asset");
        require(reservePrice > 0,          "AuctionHouse: zero reserve");
        require(duration    >= MIN_DURATION && duration <= MAX_DURATION, "AuctionHouse: bad duration");
        require(assetAmount > 0,           "AuctionHouse: zero amount");

        auctionId = _nextAuctionId();
        uint256 start = block.timestamp;
        uint256 end   = start + duration;

        auctions[auctionId] = Auction({
            auctionId:   auctionId,
            auctionType: AuctionType.ENGLISH,
            assetType:   assetType,
            status:      AuctionStatus.OPEN,
            seller:      msg.sender,
            assetToken:  assetToken,
            assetId:     assetId,
            assetAmount: assetAmount,
            startPrice:  reservePrice,
            endPrice:    0,
            startTime:   start,
            endTime:     end,
            highBidder:  address(0),
            highBid:     0,
            metadataUri: metadataUri
        });

        _escrowAsset(assetType, assetToken, assetId, assetAmount, msg.sender);

        emit AuctionCreated(auctionId, msg.sender, AuctionType.ENGLISH, assetType, assetToken, reservePrice, 0, start, end);
    }

    /**
     * @notice Place a bid on an English auction.
     *         Must exceed current high bid by at least MIN_BID_INCREMENT_BP.
     *         Outbid ETH is queued for refund (pull pattern).
     */
    function placeBid(uint256 auctionId) external payable nonReentrant whenNotPaused {
        Auction storage a = _requireOpenAuction(auctionId);
        require(a.auctionType == AuctionType.ENGLISH, "AuctionHouse: not English");
        require(block.timestamp < a.endTime,           "AuctionHouse: auction ended");

        uint256 minBid = a.highBid == 0
            ? a.startPrice
            : a.highBid + (a.highBid * MIN_BID_INCREMENT_BP) / BASIS_POINTS;

        require(msg.value >= minBid, "AuctionHouse: bid too low");

        // Queue refund for previous high bidder
        if (a.highBidder != address(0)) {
            pendingRefunds[auctionId][a.highBidder] += a.highBid;
        }

        uint256 previous = a.highBid;
        a.highBidder = msg.sender;
        a.highBid    = msg.value;

        emit BidPlaced(auctionId, msg.sender, msg.value, previous);
    }

    /**
     * @notice Settle an English auction after deadline. Transfers asset to winner,
     *         ETH (minus fee) to seller.
     */
    function settleEnglishAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.auctionId != 0,                      "AuctionHouse: not found");
        require(a.status == AuctionStatus.OPEN,         "AuctionHouse: not open");
        require(a.auctionType == AuctionType.ENGLISH,  "AuctionHouse: not English");
        require(block.timestamp >= a.endTime,           "AuctionHouse: not ended");

        if (a.highBidder == address(0)) {
            // No bids — cancel and return asset to seller
            a.status = AuctionStatus.CANCELLED;
            _releaseAsset(a.assetType, a.assetToken, a.assetId, a.assetAmount, a.seller);
            emit AuctionCancelled(auctionId, a.seller);
            return;
        }

        a.status = AuctionStatus.SETTLED;
        _settleAuction(auctionId, a.highBidder, a.highBid);

        emit AuctionSettled(auctionId, a.highBidder, a.highBid, (a.highBid * feeBP) / BASIS_POINTS);
    }

    /**
     * @notice Claim a pending ETH refund from being outbid.
     */
    function claimRefund(uint256 auctionId) external nonReentrant {
        uint256 amount = pendingRefunds[auctionId][msg.sender];
        require(amount > 0, "AuctionHouse: no refund");
        pendingRefunds[auctionId][msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "AuctionHouse: refund failed");
        emit RefundClaimed(auctionId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cancellation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Seller can cancel an auction with no bids, or admin can cancel any time.
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.auctionId != 0,          "AuctionHouse: not found");
        require(a.status == AuctionStatus.OPEN, "AuctionHouse: not open");
        require(
            msg.sender == a.seller || hasRole(AUCTION_ADMIN, msg.sender),
            "AuctionHouse: not authorized"
        );
        if (msg.sender == a.seller) {
            require(a.highBid == 0, "AuctionHouse: bids exist");
        }

        a.status = AuctionStatus.CANCELLED;
        _releaseAsset(a.assetType, a.assetToken, a.assetId, a.assetAmount, a.seller);

        // Refund any existing high bid (admin cancel case)
        if (a.highBidder != address(0) && a.highBid > 0) {
            pendingRefunds[auctionId][a.highBidder] += a.highBid;
        }

        emit AuctionCancelled(auctionId, a.seller);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setFee(uint256 newFeeBP) external onlyRole(FEE_MANAGER) {
        require(newFeeBP <= MAX_FEE_BP, "AuctionHouse: fee too high");
        feeBP = newFeeBP;
    }

    function setTreasury(address _treasury) external onlyRole(AUCTION_ADMIN) {
        require(_treasury != address(0), "AuctionHouse: zero address");
        treasury = _treasury;
    }

    function pause()   external onlyRole(AUCTION_ADMIN) { _pause(); }
    function unpause() external onlyRole(AUCTION_ADMIN) { _unpause(); }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _nextAuctionId() internal returns (uint256) {
        _auctionIdCounter.increment();
        return _auctionIdCounter.current();
    }

    function _requireOpenAuction(uint256 auctionId) internal view returns (Auction storage a) {
        a = auctions[auctionId];
        require(a.auctionId != 0,               "AuctionHouse: not found");
        require(a.status == AuctionStatus.OPEN, "AuctionHouse: not open");
    }

    function _escrowAsset(
        AssetType assetType,
        address   assetToken,
        uint256   assetId,
        uint256   assetAmount,
        address   from
    ) internal {
        if (assetType == AssetType.ERC721) {
            IERC721(assetToken).transferFrom(from, address(this), assetId);
        } else {
            IERC20(assetToken).safeTransferFrom(from, address(this), assetAmount);
        }
    }

    function _releaseAsset(
        AssetType assetType,
        address   assetToken,
        uint256   assetId,
        uint256   assetAmount,
        address   to
    ) internal {
        if (assetType == AssetType.ERC721) {
            IERC721(assetToken).transferFrom(address(this), to, assetId);
        } else {
            IERC20(assetToken).safeTransfer(to, assetAmount);
        }
    }

    function _settleAuction(uint256 auctionId, address winner, uint256 price) internal {
        Auction storage a = auctions[auctionId];

        uint256 fee     = (price * feeBP) / BASIS_POINTS;
        uint256 proceeds = price - fee;

        // Transfer asset to winner
        _releaseAsset(a.assetType, a.assetToken, a.assetId, a.assetAmount, winner);

        // Pay seller
        (bool sellerOk, ) = a.seller.call{value: proceeds}("");
        require(sellerOk, "AuctionHouse: seller payment failed");

        // Pay fee
        if (fee > 0) {
            (bool feeOk, ) = treasury.call{value: fee}("");
            require(feeOk, "AuctionHouse: fee transfer failed");
        }
    }
}
