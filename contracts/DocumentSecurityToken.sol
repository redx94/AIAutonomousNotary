// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DocumentSecurityToken
 * @dev ERC-3643 compliant security token for fractional document ownership
 * Implements regulatory compliance features for securities trading
 */
contract DocumentSecurityToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant TRANSFER_AGENT_ROLE = keccak256("TRANSFER_AGENT_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    struct TokenInfo {
        bytes32 documentHash;
        uint256 totalSupply;
        uint256 issuanceDate;
        string jurisdiction;
        bool isFractionalized;
        uint256 minimumInvestment;
        address notaryContract;
    }

    TokenInfo public tokenInfo;

    // Transfer restrictions
    mapping(address => bool) public frozenAccounts;
    mapping(address => uint256) public lockupPeriods;
    mapping(address => bool) public accreditedInvestors;

    // Events
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event LockupSet(address indexed account, uint256 lockupEnd);
    event AccreditedInvestorSet(address indexed account, bool status);
    event DocumentFractionalized(bytes32 indexed documentHash, uint256 totalTokens);

    /**
     * @dev Constructor for DocumentSecurityToken
     * @param name Token name
     * @param symbol Token symbol
     * @param documentHash Hash of the underlying document
     * @param initialSupply Initial token supply
     * @param jurisdiction Regulatory jurisdiction
     * @param minimumInvestment Minimum investment amount
     * @param notaryContract Address of the notary contract
     */
    constructor(
        string memory name,
        string memory symbol,
        bytes32 documentHash,
        uint256 initialSupply,
        string memory jurisdiction,
        uint256 minimumInvestment,
        address notaryContract
    ) ERC20(name, symbol) {
        require(initialSupply > 0, "Initial supply must be greater than 0");
        require(minimumInvestment > 0, "Minimum investment must be greater than 0");
        require(notaryContract != address(0), "Notary contract address required");

        tokenInfo = TokenInfo({
            documentHash: documentHash,
            totalSupply: initialSupply,
            issuanceDate: block.timestamp,
            jurisdiction: jurisdiction,
            isFractionalized: true,
            minimumInvestment: minimumInvestment,
            notaryContract: notaryContract
        });

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ISSUER_ROLE, msg.sender);
        _setupRole(COMPLIANCE_ROLE, msg.sender);

        _mint(msg.sender, initialSupply);

        emit DocumentFractionalized(documentHash, initialSupply);
    }

    /**
     * @dev Transfer function with compliance checks
     * @param recipient Address to receive tokens
     * @param amount Amount to transfer
     * @return success Transfer success status
     */
    function transfer(address recipient, uint256 amount)
        public
        override
        whenNotPaused
        nonReentrant
        returns (bool)
    {
        require(!frozenAccounts[msg.sender], "Sender account is frozen");
        require(!frozenAccounts[recipient], "Recipient account is frozen");
        require(block.timestamp >= lockupPeriods[msg.sender], "Sender is in lockup period");
        require(accreditedInvestors[recipient] || amount >= tokenInfo.minimumInvestment, "Minimum investment not met");

        return super.transfer(recipient, amount);
    }

    /**
     * @dev TransferFrom function with compliance checks
     * @param sender Address sending tokens
     * @param recipient Address to receive tokens
     * @param amount Amount to transfer
     * @return success Transfer success status
     */
    function transferFrom(address sender, address recipient, uint256 amount)
        public
        override
        whenNotPaused
        nonReentrant
        returns (bool)
    {
        require(!frozenAccounts[sender], "Sender account is frozen");
        require(!frozenAccounts[recipient], "Recipient account is frozen");
        require(block.timestamp >= lockupPeriods[sender], "Sender is in lockup period");
        require(accreditedInvestors[recipient] || amount >= tokenInfo.minimumInvestment, "Minimum investment not met");

        return super.transferFrom(sender, recipient, amount);
    }

    /**
     * @dev Freeze an account (compliance function)
     * @param account Address to freeze
     */
    function freezeAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        frozenAccounts[account] = true;
        emit AccountFrozen(account);
    }

    /**
     * @dev Unfreeze an account (compliance function)
     * @param account Address to unfreeze
     */
    function unfreezeAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account);
    }

    /**
     * @dev Set lockup period for an account
     * @param account Address to set lockup for
     * @param lockupEnd Timestamp when lockup ends
     */
    function setLockupPeriod(address account, uint256 lockupEnd) external onlyRole(COMPLIANCE_ROLE) {
        require(lockupEnd > block.timestamp, "Lockup end must be in the future");
        lockupPeriods[account] = lockupEnd;
        emit LockupSet(account, lockupEnd);
    }

    /**
     * @dev Set accredited investor status
     * @param account Address to set status for
     * @param status Accredited investor status
     */
    function setAccreditedInvestor(address account, bool status) external onlyRole(COMPLIANCE_ROLE) {
        accreditedInvestors[account] = status;
        emit AccreditedInvestorSet(account, status);
    }

    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Mint additional tokens (issuer only)
     * @param account Address to mint to
     * @param amount Amount to mint
     */
    function mint(address account, uint256 amount) external onlyRole(ISSUER_ROLE) {
        require(accreditedInvestors[account], "Recipient must be accredited investor");
        _mint(account, amount);
    }

    /**
     * @dev Burn tokens (compliance function)
     * @param account Address to burn from
     * @param amount Amount to burn
     */
    function burn(address account, uint256 amount) external onlyRole(COMPLIANCE_ROLE) {
        _burn(account, amount);
    }

    /**
     * @dev Get token information
     * @return TokenInfo struct
     */
    function getTokenInfo() external view returns (TokenInfo memory) {
        return tokenInfo;
    }

    /**
     * @dev Check if transfer is compliant
     * @param sender Sender address
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @return bool Compliance status
     */
    function isTransferCompliant(address sender, address recipient, uint256 amount)
        external
        view
        returns (bool)
    {
        if (frozenAccounts[sender] || frozenAccounts[recipient]) return false;
        if (block.timestamp < lockupPeriods[sender]) return false;
        if (!accreditedInvestors[recipient] && amount < tokenInfo.minimumInvestment) return false;
        return true;
    }
}
