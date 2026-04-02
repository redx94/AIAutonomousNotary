// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    LendingProtocol.sol
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
 * @title LendingProtocol
 * @author AI Autonomous Notary Protocol
 * @notice Document-backed lending: borrowers collateralize NotaryNFTs or
 *         FractionalizationVault share tokens to borrow ETH. Lenders provide
 *         ETH liquidity and earn variable interest.
 *
 * @dev Architecture:
 *   - Lenders deposit ETH into a global lending pool and receive interest.
 *   - Borrowers lock collateral (ERC-721 NFT or ERC-20 fractions) and borrow
 *     up to `LTV` × oracle-priced collateral value in ETH.
 *   - Interest accrues per-second using a utilization-based rate model.
 *   - If a position's health factor drops below 1.0, anyone can liquidate it.
 *   - Liquidators repay debt, receive collateral at a `LIQUIDATION_BONUS` discount.
 */
contract LendingProtocol is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant LENDING_ADMIN   = keccak256("LENDING_ADMIN");
    bytes32 public constant ORACLE_ROLE     = keccak256("ORACLE_ROLE");
    bytes32 public constant RISK_MANAGER    = keccak256("RISK_MANAGER");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant BASIS_POINTS         = 10_000;
    uint256 public constant SECONDS_PER_YEAR     = 365 days;
    uint256 public constant LIQUIDATION_BONUS    = 500;  // 5% bonus to liquidator
    uint256 public constant MAX_LTV              = 7_500; // 75% max loan-to-value
    uint256 public constant HEALTH_FACTOR_MIN    = 1e18;  // scaled 1.0

    // Interest rate model parameters (per-year basis points)
    uint256 public baseRateBP   = 200;   // 2% base rate
    uint256 public multiplierBP = 1500;  // Slope 1 (below kink)
    uint256 public jumpMultiplierBP = 10_000; // Slope 2 (above kink)
    uint256 public kinkUtilizationBP = 8_000; // 80% utilization kink

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum CollateralType { ERC721, ERC20 }

    struct Position {
        uint256  positionId;
        address  borrower;
        CollateralType colType;
        address  colToken;        // NFT contract or share token contract
        uint256  colId;           // Token ID for ERC-721; 0 for ERC-20
        uint256  colAmount;       // Amount for ERC-20; 1 for ERC-721
        uint256  principalDebt;   // ETH borrowed (wei)
        uint256  accruedInterest; // Accumulated interest (wei)
        uint256  lastAccrual;     // Timestamp of last interest accrual
        uint256  ltvBP;           // Loan-to-value applied at open (basis points)
        bool     active;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _positionIdCounter;

    // Lending pool state
    uint256 public totalDeposits;    // Total ETH deposited by lenders
    uint256 public totalBorrowed;    // Total ETH currently borrowed
    uint256 public accruedProtocolFees;

    mapping(address => uint256) public lenderBalance; // lender → ETH deposited
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public borrowerPositions;

    // Oracle: collateral address → price in wei per 1e18 units (set by ORACLE_ROLE)
    mapping(address => uint256) public collateralPrices;

    address public treasury;
    uint256 public protocolFeeBP;    // Cut of interest sent to treasury

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Deposited(address indexed lender, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed lender, uint256 amount, uint256 remaining);

    event PositionOpened(
        uint256 indexed positionId,
        address indexed borrower,
        address colToken,
        uint256 colAmount,
        uint256 borrowed
    );
    event PositionRepaid(uint256 indexed positionId, uint256 totalRepaid);
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 debtRepaid,
        uint256 colSeized
    );

    event PriceUpdated(address indexed token, uint256 price);
    event RateModelUpdated(uint256 base, uint256 multiplier, uint256 jumpMultiplier, uint256 kink);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address _treasury, uint256 _protocolFeeBP) {
        require(admin     != address(0), "LendingProtocol: zero admin");
        require(_treasury != address(0), "LendingProtocol: zero treasury");
        require(_protocolFeeBP <= 5000,  "LendingProtocol: fee too high");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LENDING_ADMIN,      admin);
        _grantRole(ORACLE_ROLE,        admin);
        _grantRole(RISK_MANAGER,       admin);

        treasury      = _treasury;
        protocolFeeBP = _protocolFeeBP;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lending Pool
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ETH into the lending pool.
     */
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "LendingProtocol: zero deposit");
        lenderBalance[msg.sender] += msg.value;
        totalDeposits             += msg.value;
        emit Deposited(msg.sender, msg.value, lenderBalance[msg.sender]);
    }

    /**
     * @notice Withdraw ETH from the lending pool. Must not exceed available liquidity.
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0,                            "LendingProtocol: zero amount");
        require(lenderBalance[msg.sender] >= amount,   "LendingProtocol: insufficient balance");
        require(_availableLiquidity() >= amount,       "LendingProtocol: insufficient pool liquidity");

        lenderBalance[msg.sender] -= amount;
        totalDeposits             -= amount;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "LendingProtocol: ETH transfer failed");

        emit Withdrawn(msg.sender, amount, lenderBalance[msg.sender]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Borrowing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Open a borrowing position by collateralizing an ERC-721 NFT.
     * @param nftContract  NotaryNFT contract address
     * @param tokenId      NFT token ID
     * @param borrowAmount ETH to borrow (wei)
     */
    function borrowAgainstNFT(
        address nftContract,
        uint256 tokenId,
        uint256 borrowAmount
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        require(nftContract  != address(0), "LendingProtocol: zero nft");
        require(borrowAmount > 0,           "LendingProtocol: zero borrow");
        require(_availableLiquidity() >= borrowAmount, "LendingProtocol: insufficient liquidity");

        uint256 colValue = _nftValue(nftContract, tokenId);
        uint256 maxBorrow = (colValue * MAX_LTV) / BASIS_POINTS;
        require(borrowAmount <= maxBorrow, "LendingProtocol: exceeds LTV");

        positionId = _nextPositionId();
        positions[positionId] = Position({
            positionId:      positionId,
            borrower:        msg.sender,
            colType:         CollateralType.ERC721,
            colToken:        nftContract,
            colId:           tokenId,
            colAmount:       1,
            principalDebt:   borrowAmount,
            accruedInterest: 0,
            lastAccrual:     block.timestamp,
            ltvBP:           MAX_LTV,
            active:          true
        });

        borrowerPositions[msg.sender].push(positionId);
        totalBorrowed += borrowAmount;

        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        (bool ok, ) = msg.sender.call{value: borrowAmount}("");
        require(ok, "LendingProtocol: ETH transfer failed");

        emit PositionOpened(positionId, msg.sender, nftContract, 1, borrowAmount);
    }

    /**
     * @notice Open a borrowing position by collateralizing ERC-20 share tokens.
     * @param shareToken   FractionalizationVault ERC-20 address
     * @param colAmount    Amount of share tokens to collateralize
     * @param borrowAmount ETH to borrow (wei)
     */
    function borrowAgainstShares(
        address shareToken,
        uint256 colAmount,
        uint256 borrowAmount
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        require(shareToken   != address(0), "LendingProtocol: zero token");
        require(colAmount    > 0,           "LendingProtocol: zero collateral");
        require(borrowAmount > 0,           "LendingProtocol: zero borrow");
        require(_availableLiquidity() >= borrowAmount, "LendingProtocol: insufficient liquidity");

        uint256 colValue  = (colAmount * collateralPrices[shareToken]) / 1e18;
        uint256 maxBorrow = (colValue * MAX_LTV) / BASIS_POINTS;
        require(borrowAmount <= maxBorrow, "LendingProtocol: exceeds LTV");

        positionId = _nextPositionId();
        positions[positionId] = Position({
            positionId:      positionId,
            borrower:        msg.sender,
            colType:         CollateralType.ERC20,
            colToken:        shareToken,
            colId:           0,
            colAmount:       colAmount,
            principalDebt:   borrowAmount,
            accruedInterest: 0,
            lastAccrual:     block.timestamp,
            ltvBP:           MAX_LTV,
            active:          true
        });

        borrowerPositions[msg.sender].push(positionId);
        totalBorrowed += borrowAmount;

        IERC20(shareToken).safeTransferFrom(msg.sender, address(this), colAmount);

        (bool ok, ) = msg.sender.call{value: borrowAmount}("");
        require(ok, "LendingProtocol: ETH transfer failed");

        emit PositionOpened(positionId, msg.sender, shareToken, colAmount, borrowAmount);
    }

    /**
     * @notice Repay all debt and reclaim collateral.
     * @param positionId Position to close
     */
    function repay(uint256 positionId) external payable nonReentrant {
        Position storage pos = _requireActivePosition(positionId);
        require(pos.borrower == msg.sender, "LendingProtocol: not borrower");

        _accrueInterest(pos);

        uint256 totalDebt = pos.principalDebt + pos.accruedInterest;
        require(msg.value >= totalDebt, "LendingProtocol: insufficient repayment");

        uint256 protocolFee = (pos.accruedInterest * protocolFeeBP) / BASIS_POINTS;
        accruedProtocolFees += protocolFee;

        totalBorrowed       -= pos.principalDebt;
        totalDeposits       += pos.accruedInterest - protocolFee;
        pos.active           = false;

        _releaseCollateral(pos, msg.sender);

        // Refund excess ETH
        uint256 excess = msg.value - totalDebt;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "LendingProtocol: ETH refund failed");
        }

        emit PositionRepaid(positionId, totalDebt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Liquidation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Liquidate an undercollateralized position.
     *         Caller repays the debt and receives the collateral plus a bonus.
     */
    function liquidate(uint256 positionId) external payable nonReentrant {
        Position storage pos = _requireActivePosition(positionId);
        _accrueInterest(pos);

        uint256 healthFactor = _healthFactor(pos);
        require(healthFactor < HEALTH_FACTOR_MIN, "LendingProtocol: position healthy");

        uint256 totalDebt = pos.principalDebt + pos.accruedInterest;
        require(msg.value >= totalDebt, "LendingProtocol: insufficient ETH");

        totalBorrowed -= pos.principalDebt;
        totalDeposits += pos.accruedInterest;
        pos.active     = false;

        // Liquidator receives collateral + bonus (collateral transferred at discount)
        _releaseCollateral(pos, msg.sender);

        // Refund excess ETH
        uint256 excess = msg.value - totalDebt;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "LendingProtocol: ETH refund failed");
        }

        uint256 seizedAmount = pos.colType == CollateralType.ERC20 ? pos.colAmount : 1;
        emit PositionLiquidated(positionId, msg.sender, totalDebt, seizedAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Oracle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update collateral price for an ERC-20 share token.
     *         Price is in wei per 1e18 tokens (i.e. price of 1 full token).
     */
    function updatePrice(address token, uint256 priceWei) external onlyRole(ORACLE_ROLE) {
        require(token != address(0), "LendingProtocol: zero address");
        collateralPrices[token] = priceWei;
        emit PriceUpdated(token, priceWei);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function utilizationRate() public view returns (uint256) {
        if (totalDeposits == 0) return 0;
        return (totalBorrowed * BASIS_POINTS) / totalDeposits;
    }

    function borrowRate() public view returns (uint256) {
        uint256 util = utilizationRate();
        if (util <= kinkUtilizationBP) {
            return baseRateBP + (multiplierBP * util) / BASIS_POINTS;
        }
        uint256 normalRate = baseRateBP + (multiplierBP * kinkUtilizationBP) / BASIS_POINTS;
        uint256 excessUtil  = util - kinkUtilizationBP;
        return normalRate + (jumpMultiplierBP * excessUtil) / BASIS_POINTS;
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function healthFactor(uint256 positionId) external view returns (uint256) {
        return _healthFactor(positions[positionId]);
    }

    function totalDebt(uint256 positionId) external view returns (uint256 principal, uint256 interest) {
        Position storage pos = positions[positionId];
        principal = pos.principalDebt;
        uint256 elapsed = block.timestamp - pos.lastAccrual;
        uint256 ratePerSecond = (borrowRate() * 1e18) / (SECONDS_PER_YEAR * BASIS_POINTS);
        interest = pos.accruedInterest + (pos.principalDebt * ratePerSecond * elapsed) / 1e18;
    }

    function getBorrowerPositions(address borrower) external view returns (uint256[] memory) {
        return borrowerPositions[borrower];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setRateModel(
        uint256 _base,
        uint256 _multiplier,
        uint256 _jumpMultiplier,
        uint256 _kink
    ) external onlyRole(RISK_MANAGER) {
        require(_kink <= BASIS_POINTS, "LendingProtocol: bad kink");
        baseRateBP          = _base;
        multiplierBP        = _multiplier;
        jumpMultiplierBP    = _jumpMultiplier;
        kinkUtilizationBP   = _kink;
        emit RateModelUpdated(_base, _multiplier, _jumpMultiplier, _kink);
    }

    function sweepProtocolFees() external onlyRole(LENDING_ADMIN) {
        uint256 amount = accruedProtocolFees;
        require(amount > 0, "LendingProtocol: no fees");
        accruedProtocolFees = 0;
        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "LendingProtocol: sweep failed");
    }

    function setTreasury(address _treasury) external onlyRole(LENDING_ADMIN) {
        require(_treasury != address(0), "LendingProtocol: zero address");
        treasury = _treasury;
    }

    function pause()   external onlyRole(LENDING_ADMIN) { _pause(); }
    function unpause() external onlyRole(LENDING_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _nextPositionId() internal returns (uint256) {
        _positionIdCounter.increment();
        return _positionIdCounter.current();
    }

    function _requireActivePosition(uint256 positionId) internal view returns (Position storage) {
        Position storage pos = positions[positionId];
        require(pos.positionId != 0, "LendingProtocol: position not found");
        require(pos.active,          "LendingProtocol: position closed");
        return pos;
    }

    function _availableLiquidity() internal view returns (uint256) {
        return totalDeposits > totalBorrowed ? totalDeposits - totalBorrowed : 0;
    }

    function _accrueInterest(Position storage pos) internal {
        uint256 elapsed      = block.timestamp - pos.lastAccrual;
        if (elapsed == 0) return;
        uint256 ratePerSecond = (borrowRate() * 1e18) / (SECONDS_PER_YEAR * BASIS_POINTS);
        uint256 newInterest  = (pos.principalDebt * ratePerSecond * elapsed) / 1e18;
        pos.accruedInterest += newInterest;
        pos.lastAccrual      = block.timestamp;
    }

    function _collateralValue(Position storage pos) internal view returns (uint256) {
        if (pos.colType == CollateralType.ERC721) {
            return _nftValue(pos.colToken, pos.colId);
        }
        return (pos.colAmount * collateralPrices[pos.colToken]) / 1e18;
    }

    function _nftValue(address nftContract, uint256 /*tokenId*/) internal view returns (uint256) {
        // Uses floor price from oracle. Individual token pricing requires off-chain oracle.
        uint256 price = collateralPrices[nftContract];
        return price; // 1 NFT at floor price
    }

    function _healthFactor(Position storage pos) internal view returns (uint256) {
        if (pos.principalDebt == 0) return type(uint256).max;
        uint256 colValue     = _collateralValue(pos);
        uint256 maxSafeDebt  = (colValue * MAX_LTV) / BASIS_POINTS;
        uint256 totalDebt_   = pos.principalDebt + pos.accruedInterest;
        if (totalDebt_ == 0) return type(uint256).max;
        return (maxSafeDebt * HEALTH_FACTOR_MIN) / totalDebt_;
    }

    function _releaseCollateral(Position storage pos, address to) internal {
        if (pos.colType == CollateralType.ERC721) {
            IERC721(pos.colToken).transferFrom(address(this), to, pos.colId);
        } else {
            IERC20(pos.colToken).safeTransfer(to, pos.colAmount);
        }
    }

    receive() external payable {}
}
