// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    AMM.sol
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
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AMM
 * @author AI Autonomous Notary Protocol
 * @notice Constant-product automated market maker for document share tokens vs ETH.
 *         Each FractionalizationVault share token gets its own liquidity pool.
 *         LP tokens represent proportional pool ownership and earn swap fees.
 *
 * @dev Uses x*y=k invariant (Uniswap v2 model).
 *      - Pool token (LP) minted to liquidity providers
 *      - 0.3% swap fee (configurable, max 1%) accumulates in pool reserves
 *      - No oracle price manipulation protection needed (ETH-only pairs)
 *      - Minimum liquidity of 1000 units burned on first mint (prevents inflation attack)
 */
contract AMM is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant AMM_ADMIN  = keccak256("AMM_ADMIN");
    bytes32 public constant FEE_SETTER = keccak256("FEE_SETTER");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant MINIMUM_LIQUIDITY = 1_000;
    uint256 public constant BASIS_POINTS      = 10_000;
    uint256 public constant MAX_SWAP_FEE_BP   = 100; // 1%

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Pool {
        address shareToken;      // FractionalizationVault ERC-20
        uint256 reserveToken;    // Share token reserves
        uint256 reserveEth;      // ETH reserves (wei)
        uint256 lpTotalSupply;   // Outstanding LP token supply
        uint256 swapFeeBP;       // Swap fee (basis points)
        bool    exists;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    // shareToken address → Pool
    mapping(address => Pool) public pools;
    address[] public poolList;

    // (shareToken, lpHolder) → LP balance
    mapping(address => mapping(address => uint256)) public lpBalances;

    // Collected protocol fees (ETH) waiting for treasury sweep
    uint256 public collectedFees;
    address public treasury;
    uint256 public protocolFeeBP; // Slice of swap fee sent to treasury (max 50% of feeBP)

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event PoolCreated(address indexed shareToken, uint256 swapFeeBP);

    event LiquidityAdded(
        address indexed shareToken,
        address indexed provider,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lpMinted
    );

    event LiquidityRemoved(
        address indexed shareToken,
        address indexed provider,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lpBurned
    );

    event Swap(
        address indexed shareToken,
        address indexed trader,
        bool    tokenIn,         // true = sold tokens, false = sold ETH
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event FeeSwept(address indexed treasury, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address _treasury, uint256 _protocolFeeBP) {
        require(admin     != address(0), "AMM: zero admin");
        require(_treasury != address(0), "AMM: zero treasury");
        require(_protocolFeeBP <= 5000,  "AMM: protocol fee too high");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AMM_ADMIN,          admin);
        _grantRole(FEE_SETTER,         admin);

        treasury      = _treasury;
        protocolFeeBP = _protocolFeeBP;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pool Creation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new ETH/shareToken liquidity pool.
     * @param shareToken  FractionalizationVault ERC-20 address
     * @param swapFeeBP   Swap fee in basis points (e.g. 30 = 0.3%)
     */
    function createPool(address shareToken, uint256 swapFeeBP)
        external
        onlyRole(AMM_ADMIN)
    {
        require(shareToken          != address(0),   "AMM: zero token");
        require(!pools[shareToken].exists,           "AMM: pool exists");
        require(swapFeeBP           <= MAX_SWAP_FEE_BP, "AMM: fee too high");

        pools[shareToken] = Pool({
            shareToken:   shareToken,
            reserveToken: 0,
            reserveEth:   0,
            lpTotalSupply:0,
            swapFeeBP:    swapFeeBP,
            exists:       true
        });
        poolList.push(shareToken);

        emit PoolCreated(shareToken, swapFeeBP);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Liquidity
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Add liquidity to a pool. Caller sends ETH and approves tokens.
     *         LP tokens representing pool share are credited to `msg.sender`.
     * @param shareToken   Pool token
     * @param tokenDesired Desired token amount; may receive less if ETH ratio dictates
     * @param tokenMin     Slippage guard on token amount
     * @param ethMin       Slippage guard on ETH amount
     */
    function addLiquidity(
        address shareToken,
        uint256 tokenDesired,
        uint256 tokenMin,
        uint256 ethMin
    ) external payable nonReentrant whenNotPaused returns (uint256 lpMinted) {
        Pool storage pool = _requirePool(shareToken);
        require(msg.value > 0,          "AMM: zero ETH");
        require(tokenDesired > 0,       "AMM: zero tokens");

        uint256 tokenAmount;
        uint256 ethAmount;

        if (pool.lpTotalSupply == 0) {
            // First liquidity event
            tokenAmount = tokenDesired;
            ethAmount   = msg.value;
            lpMinted    = Math.sqrt(tokenAmount * ethAmount) - MINIMUM_LIQUIDITY;
            // Burn minimum liquidity (send to address(1)) to prevent inflation attacks
            _mintLP(shareToken, address(1), MINIMUM_LIQUIDITY);
        } else {
            // Match existing ratio
            uint256 ethOptimal = (tokenDesired * pool.reserveEth) / pool.reserveToken;
            if (ethOptimal <= msg.value) {
                require(ethOptimal >= ethMin, "AMM: slippage ETH");
                tokenAmount = tokenDesired;
                ethAmount   = ethOptimal;
            } else {
                uint256 tokenOptimal = (msg.value * pool.reserveToken) / pool.reserveEth;
                require(tokenOptimal >= tokenMin, "AMM: slippage token");
                tokenAmount = tokenOptimal;
                ethAmount   = msg.value;
            }
            lpMinted = Math.min(
                (tokenAmount * pool.lpTotalSupply) / pool.reserveToken,
                (ethAmount   * pool.lpTotalSupply) / pool.reserveEth
            );
        }

        require(lpMinted > 0, "AMM: insufficient liquidity minted");

        IERC20(shareToken).safeTransferFrom(msg.sender, address(this), tokenAmount);
        pool.reserveToken  += tokenAmount;
        pool.reserveEth    += ethAmount;
        _mintLP(shareToken, msg.sender, lpMinted);

        // Refund excess ETH
        uint256 excess = msg.value - ethAmount;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "AMM: ETH refund failed");
        }

        emit LiquidityAdded(shareToken, msg.sender, tokenAmount, ethAmount, lpMinted);
    }

    /**
     * @notice Remove liquidity from a pool. Burns LP tokens, returns token + ETH.
     * @param shareToken FractionalizationVault ERC-20 address
     * @param lpAmount   LP tokens to burn
     * @param tokenMin   Slippage guard on token return
     * @param ethMin     Slippage guard on ETH return
     */
    function removeLiquidity(
        address shareToken,
        uint256 lpAmount,
        uint256 tokenMin,
        uint256 ethMin
    ) external nonReentrant whenNotPaused returns (uint256 tokenOut, uint256 ethOut) {
        Pool storage pool = _requirePool(shareToken);
        require(lpBalances[shareToken][msg.sender] >= lpAmount, "AMM: insufficient LP");
        require(lpAmount > 0, "AMM: zero LP");

        tokenOut = (lpAmount * pool.reserveToken) / pool.lpTotalSupply;
        ethOut   = (lpAmount * pool.reserveEth)   / pool.lpTotalSupply;

        require(tokenOut >= tokenMin, "AMM: token slippage");
        require(ethOut   >= ethMin,   "AMM: ETH slippage");

        _burnLP(shareToken, msg.sender, lpAmount);
        pool.reserveToken -= tokenOut;
        pool.reserveEth   -= ethOut;

        IERC20(shareToken).safeTransfer(msg.sender, tokenOut);
        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "AMM: ETH transfer failed");

        emit LiquidityRemoved(shareToken, msg.sender, tokenOut, ethOut, lpAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Swaps
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Buy share tokens with ETH (ETH → token swap).
     * @param shareToken FractionalizationVault ERC-20 address
     * @param amountOutMin Minimum tokens expected (slippage guard)
     */
    function swapEthForTokens(
        address shareToken,
        uint256 amountOutMin
    ) external payable nonReentrant whenNotPaused returns (uint256 amountOut) {
        Pool storage pool = _requirePool(shareToken);
        require(msg.value > 0, "AMM: zero ETH");

        uint256 fee          = (msg.value * pool.swapFeeBP) / BASIS_POINTS;
        uint256 protocolFee  = (fee * protocolFeeBP) / BASIS_POINTS;
        uint256 ethInAfterFee = msg.value - fee;

        amountOut = _getAmountOut(ethInAfterFee, pool.reserveEth, pool.reserveToken);
        require(amountOut >= amountOutMin, "AMM: slippage");
        require(amountOut < pool.reserveToken, "AMM: insufficient liquidity");

        pool.reserveEth    += ethInAfterFee;
        pool.reserveToken  -= amountOut;
        collectedFees      += protocolFee;

        IERC20(shareToken).safeTransfer(msg.sender, amountOut);

        emit Swap(shareToken, msg.sender, false, msg.value, amountOut, fee);
    }

    /**
     * @notice Sell share tokens for ETH (token → ETH swap).
     * @param shareToken  FractionalizationVault ERC-20 address
     * @param amountIn    Token amount to sell
     * @param amountOutMin Minimum ETH expected (slippage guard)
     */
    function swapTokensForEth(
        address shareToken,
        uint256 amountIn,
        uint256 amountOutMin
    ) external nonReentrant whenNotPaused returns (uint256 ethOut) {
        Pool storage pool = _requirePool(shareToken);
        require(amountIn > 0, "AMM: zero tokens");

        IERC20(shareToken).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 fee          = (amountIn * pool.swapFeeBP) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - fee;

        ethOut = _getAmountOut(amountInAfterFee, pool.reserveToken, pool.reserveEth);
        require(ethOut >= amountOutMin, "AMM: slippage");
        require(ethOut < pool.reserveEth, "AMM: insufficient liquidity");

        uint256 protocolFee = (fee * protocolFeeBP) / BASIS_POINTS;
        collectedFees      += protocolFee;

        pool.reserveToken  += amountInAfterFee;
        pool.reserveEth    -= ethOut;

        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "AMM: ETH transfer failed");

        emit Swap(shareToken, msg.sender, true, amountIn, ethOut, fee);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Price Oracle view
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Quote ETH cost for buying `tokenOut` share tokens.
     */
    function quoteEthForTokens(address shareToken, uint256 tokenOut)
        external view returns (uint256 ethIn)
    {
        Pool storage pool = _requirePool(shareToken);
        uint256 rawEth = _getAmountIn(tokenOut, pool.reserveEth, pool.reserveToken);
        ethIn = (rawEth * BASIS_POINTS) / (BASIS_POINTS - pool.swapFeeBP);
    }

    /**
     * @notice Quote token amount for selling `ethIn` ETH.
     */
    function quoteTokensForEth(address shareToken, uint256 ethIn)
        external view returns (uint256 tokenOut)
    {
        Pool storage pool = _requirePool(shareToken);
        uint256 ethInAfterFee = ethIn - (ethIn * pool.swapFeeBP) / BASIS_POINTS;
        tokenOut = _getAmountOut(ethInAfterFee, pool.reserveEth, pool.reserveToken);
    }

    function getPool(address shareToken) external view returns (Pool memory) {
        return pools[shareToken];
    }

    function getLPBalance(address shareToken, address provider) external view returns (uint256) {
        return lpBalances[shareToken][provider];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function sweepFees() external onlyRole(AMM_ADMIN) {
        uint256 amount = collectedFees;
        require(amount > 0, "AMM: no fees");
        collectedFees = 0;
        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "AMM: sweep failed");
        emit FeeSwept(treasury, amount);
    }

    function setTreasury(address _treasury) external onlyRole(AMM_ADMIN) {
        require(_treasury != address(0), "AMM: zero address");
        treasury = _treasury;
    }

    function setProtocolFee(uint256 _protocolFeeBP) external onlyRole(FEE_SETTER) {
        require(_protocolFeeBP <= 5000, "AMM: fee too high");
        protocolFeeBP = _protocolFeeBP;
    }

    function pause()   external onlyRole(AMM_ADMIN) { _pause(); }
    function unpause() external onlyRole(AMM_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _requirePool(address shareToken) internal view returns (Pool storage pool) {
        pool = pools[shareToken];
        require(pool.exists, "AMM: pool not found");
    }

    /// @dev x*y=k output formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        internal pure returns (uint256)
    {
        require(reserveIn > 0 && reserveOut > 0, "AMM: zero reserves");
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    /// @dev Inverse: amountIn = (reserveIn * amountOut) / (reserveOut - amountOut)
    function _getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        internal pure returns (uint256)
    {
        require(reserveIn > 0 && reserveOut > amountOut, "AMM: invalid reserves");
        return (reserveIn * amountOut) / (reserveOut - amountOut) + 1;
    }

    function _mintLP(address shareToken, address to, uint256 amount) internal {
        pools[shareToken].lpTotalSupply += amount;
        lpBalances[shareToken][to]      += amount;
    }

    function _burnLP(address shareToken, address from, uint256 amount) internal {
        pools[shareToken].lpTotalSupply      -= amount;
        lpBalances[shareToken][from]         -= amount;
    }

    receive() external payable {}
}
