// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title FractionalizationVault
 * @author AI Autonomous Notary Protocol
 * @notice Locks a NotaryNFT and issues fungible ERC-20 fraction tokens that
 *         represent proportional economic ownership of the underlying document
 *         asset. Enables democratized investment in high-value notarized
 *         documents, which is the core "static service → tradeable asset"
 *         paradigm shift of the Document Securities Market.
 *
 * @dev Architecture:
 *   1. Owner deposits their NFT → vault issues `totalShares` ERC-20 tokens
 *   2. Fraction holders earn proportional distributions (revenue / royalties)
 *   3. Any holder can initiate a buyout by offering `buyoutPrice` ETH
 *   4. Other fraction holders have a 48-hour window to veto/accept buyout
 *   5. If accepted, buyout proceeds distributed pro-rata; NFT released to buyer
 *   6. Owner can redeem all fractions to unlock the NFT at any time
 */
contract FractionalizationVault is
    ERC20,
    ERC20Burnable,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    ERC721Holder
{
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant VAULT_ADMIN      = keccak256("VAULT_ADMIN");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Constants
    // ─────────────────────────────────────────────────────────────────────────
    enum VaultState { OPEN, BUYOUT_INITIATED, CLOSED }

    uint256 public constant BUYOUT_WINDOW     = 48 hours;
    uint256 public constant MIN_BUYOUT_PREMIUM = 110; // 110% of floor price (10% premium)
    uint256 public constant BASIS_POINTS      = 10_000;

    // ─────────────────────────────────────────────────────────────────────────
    // Vault Configuration (immutable after deployment)
    // ─────────────────────────────────────────────────────────────────────────
    IERC721  public immutable nftContract;
    uint256  public immutable nftTokenId;
    uint256  public immutable totalShares;    // Total fraction tokens minted
    address  public immutable originalOwner;  // Depositor address
    uint256  public immutable listingFloor;   // Minimum valuation in wei at mint time
    uint256  public immutable feeRateBP;      // Platform fee in basis points (e.g. 200 = 2%)
    address  public immutable feeRecipient;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────
    VaultState public state;

    // Buyout state
    address public buyoutInitiator;
    uint256 public buyoutPrice;              // Total ETH offered for 100% ownership
    uint256 public buyoutDeadline;
    uint256 public buyoutVetoWeight;         // Weighted fraction holder votes against
    mapping(address => bool) public hasFiled; // Anti-double-veto

    // Revenue distribution
    uint256 public totalDistributed;         // Cumulative ETH distributed
    uint256 public distributionIndex;        // Running total ETH per share (scaled by 1e18)
    mapping(address => uint256) public holderIndex; // Last distributionIndex snapshot per holder

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────
    event VaultOpened(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed owner,
        uint256 totalShares,
        uint256 floorPrice
    );

    event BuyoutInitiated(
        address indexed initiator,
        uint256 totalPrice,
        uint256 pricePerShare,
        uint256 deadline
    );

    event BuyoutVetoed(address indexed vetoer, uint256 weight, uint256 totalVetoWeight);
    event BuyoutAccepted(address indexed buyer, uint256 price);
    event BuyoutCancelled(uint256 vetoWeight);

    event RevenueDeposited(address indexed depositor, uint256 amount, uint256 newIndex);
    event RevenueWithdrawn(address indexed holder, uint256 amount);

    event VaultRedeemed(address indexed redeemer, uint256 sharesReturned);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _nftContract,
        uint256 _nftTokenId,
        address _owner,
        uint256 _totalShares,
        uint256 _listingFloor,
        uint256 _feeRateBP,
        address _feeRecipient,
        string memory _name,
        string memory _symbol
    )
        ERC20(_name, _symbol)
    {
        require(_nftContract != address(0), "FractionalizationVault: invalid NFT");
        require(_owner != address(0),       "FractionalizationVault: invalid owner");
        require(_totalShares > 0,           "FractionalizationVault: zero shares");
        require(_feeRateBP <= 1000,         "FractionalizationVault: fee too high"); // max 10%
        require(_feeRecipient != address(0),"FractionalizationVault: invalid fee recipient");

        nftContract   = IERC721(_nftContract);
        nftTokenId    = _nftTokenId;
        originalOwner = _owner;
        totalShares   = _totalShares;
        listingFloor  = _listingFloor;
        feeRateBP     = _feeRateBP;
        feeRecipient  = _feeRecipient;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(VAULT_ADMIN,        _owner);
        _grantRole(DISTRIBUTOR_ROLE,   _owner);

        // Pull the NFT into the vault (caller must have approved this contract)
        nftContract.safeTransferFrom(_owner, address(this), _nftTokenId);

        // Mint all fraction tokens to the depositor
        _mint(_owner, _totalShares);

        state = VaultState.OPEN;

        emit VaultOpened(_nftContract, _nftTokenId, _owner, _totalShares, _listingFloor);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revenue Distribution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ETH revenue for pro-rata distribution to fraction holders
     * @dev Can be called by anyone (e.g. royalty forwarder, licensee payment)
     */
    function depositRevenue() external payable nonReentrant whenNotPaused {
        require(msg.value > 0,         "FractionalizationVault: zero deposit");
        require(state == VaultState.OPEN, "FractionalizationVault: vault not open");

        uint256 fee    = (msg.value * feeRateBP) / BASIS_POINTS;
        uint256 net    = msg.value - fee;

        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            require(feeOk, "FractionalizationVault: fee transfer failed");
        }

        distributionIndex  += (net * 1e18) / totalShares;
        totalDistributed   += net;

        emit RevenueDeposited(msg.sender, net, distributionIndex);
    }

    /**
     * @notice Claim accumulated revenue for the caller
     */
    function claimRevenue() external nonReentrant whenNotPaused {
        _settleRevenue(msg.sender);
    }

    /**
     * @notice View owed revenue for a specific holder
     */
    function pendingRevenue(address holder) external view returns (uint256) {
        uint256 unpaid = distributionIndex - holderIndex[holder];
        return (balanceOf(holder) * unpaid) / 1e18;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Buyout Mechanism
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initiate a buyout offer for the entire underlying NFT.
     *         Must offer at least listingFloor * MIN_BUYOUT_PREMIUM / 100 ETH.
     *         Fraction holders have BUYOUT_WINDOW to veto before NFT is released.
     */
    function initiateBuyout() external payable nonReentrant whenNotPaused {
        require(state == VaultState.OPEN,   "FractionalizationVault: not open");
        uint256 minPrice = (listingFloor * MIN_BUYOUT_PREMIUM) / 100;
        require(msg.value >= minPrice,      "FractionalizationVault: price too low");
        require(balanceOf(msg.sender) == 0 || totalShares == balanceOf(msg.sender),
            "FractionalizationVault: partial holder must sell first");

        state             = VaultState.BUYOUT_INITIATED;
        buyoutInitiator   = msg.sender;
        buyoutPrice       = msg.value;
        buyoutDeadline    = block.timestamp + BUYOUT_WINDOW;
        buyoutVetoWeight  = 0;

        emit BuyoutInitiated(msg.sender, msg.value, msg.value / totalShares, buyoutDeadline);
    }

    /**
     * @notice Veto the current buyout. Weight equals caller's fraction balance.
     *         If >50% of fractions veto, buyout is cancelled and ETH returned.
     */
    function vetoBuyout() external nonReentrant whenNotPaused {
        require(state == VaultState.BUYOUT_INITIATED, "FractionalizationVault: no active buyout");
        require(block.timestamp < buyoutDeadline,     "FractionalizationVault: veto window closed");
        require(!hasFiled[msg.sender],                "FractionalizationVault: already vetoed");
        require(balanceOf(msg.sender) > 0,            "FractionalizationVault: no fractions");

        hasFiled[msg.sender] = true;
        buyoutVetoWeight    += balanceOf(msg.sender);

        emit BuyoutVetoed(msg.sender, balanceOf(msg.sender), buyoutVetoWeight);

        // Cancel if majority veto
        if (buyoutVetoWeight * 2 > totalShares) {
            _cancelBuyout();
        }
    }

    /**
     * @notice Finalize buyout after window expires with insufficient veto.
     *         Distributes ETH to fraction holders; NFT transferred to buyer.
     */
    function finalizeBuyout() external nonReentrant {
        require(state == VaultState.BUYOUT_INITIATED, "FractionalizationVault: no active buyout");
        require(block.timestamp >= buyoutDeadline,    "FractionalizationVault: window not closed");

        state = VaultState.CLOSED;

        // Update distribution index so holders can claim their share
        distributionIndex += (buyoutPrice * 1e18) / totalShares;
        totalDistributed  += buyoutPrice;

        // Transfer NFT to buyer
        nftContract.safeTransferFrom(address(this), buyoutInitiator, nftTokenId);

        emit BuyoutAccepted(buyoutInitiator, buyoutPrice);
    }

    /**
     * @notice Fraction holders call this after a buyout to claim their ETH
     */
    function redeemBuyoutProceeds() external nonReentrant {
        require(state == VaultState.CLOSED, "FractionalizationVault: not closed");

        uint256 balance = balanceOf(msg.sender);
        require(balance > 0, "FractionalizationVault: no fractions");

        _settleRevenue(msg.sender);
        _burn(msg.sender, balance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Redemption (owner reclaims NFT)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Owner redeems ALL fraction tokens to unlock and reclaim the NFT.
     *         Requires holding 100% of total supply.
     */
    function redeemAll() external nonReentrant whenNotPaused {
        require(state == VaultState.OPEN,   "FractionalizationVault: not open");
        require(balanceOf(msg.sender) == totalShares, "FractionalizationVault: must own all shares");

        state = VaultState.CLOSED;
        _burn(msg.sender, totalShares);
        nftContract.safeTransferFrom(address(this), msg.sender, nftTokenId);

        emit VaultRedeemed(msg.sender, totalShares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getVaultInfo() external view returns (
        address nft_,
        uint256 tokenId_,
        uint256 totalShares_,
        uint256 floor_,
        VaultState state_,
        address buyoutInitiator_,
        uint256 buyoutPrice_,
        uint256 buyoutDeadline_,
        uint256 totalDistributed_
    ) {
        return (
            address(nftContract),
            nftTokenId,
            totalShares,
            listingFloor,
            state,
            buyoutInitiator,
            buyoutPrice,
            buyoutDeadline,
            totalDistributed
        );
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(VAULT_ADMIN) { _pause(); }
    function unpause() external onlyRole(VAULT_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _settleRevenue(address holder) internal {
        uint256 unpaid = distributionIndex - holderIndex[holder];
        if (unpaid == 0) return;

        uint256 owed = (balanceOf(holder) * unpaid) / 1e18;
        holderIndex[holder] = distributionIndex;

        if (owed > 0) {
            (bool ok, ) = holder.call{value: owed}("");
            require(ok, "FractionalizationVault: ETH transfer failed");
            emit RevenueWithdrawn(holder, owed);
        }
    }

    function _cancelBuyout() internal {
        uint256 refund = buyoutPrice;
        address initiator = buyoutInitiator;

        state            = VaultState.OPEN;
        buyoutInitiator  = address(0);
        buyoutPrice      = 0;
        buyoutDeadline   = 0;
        buyoutVetoWeight = 0;

        emit BuyoutCancelled(buyoutVetoWeight);

        (bool ok, ) = initiator.call{value: refund}("");
        require(ok, "FractionalizationVault: refund failed");
    }

    /**
     * @dev Settle revenue before balance changes to prevent distribution theft
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (from != address(0)) _settleRevenue(from);
        if (to   != address(0)) _settleRevenue(to);
        super._beforeTokenTransfer(from, to, amount);
    }

    receive() external payable {
        // Accept ETH — treated as revenue deposit
        if (msg.value > 0 && state == VaultState.OPEN) {
            distributionIndex += (msg.value * 1e18) / totalShares;
            totalDistributed  += msg.value;
            emit RevenueDeposited(msg.sender, msg.value, distributionIndex);
        }
    }
}
