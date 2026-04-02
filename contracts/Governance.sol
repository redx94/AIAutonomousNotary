// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    Governance.sol
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
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Governance
 * @author AI Autonomous Notary Protocol
 * @notice $NOTARY token-weighted DAO governance with hybrid phased model.
 *
 *   Phase 2 (current): Hybrid governance — multi-sig admin council executes
 *     proposals; $NOTARY holders vote for advisory signal and veto power.
 *   Phase 3+: Full on-chain execution via Timelock controller.
 *
 * @dev Proposal lifecycle:
 *   1. `propose` — Any holder with >= proposalThreshold tokens creates proposal
 *   2. Voting delay (configurable, default 2 days)
 *   3. Voting period (configurable, default 7 days)
 *   4. `queue` — Passed proposals enter 48-hour execution timelock
 *   5. `execute` — Admin council executes after timelock (hybrid mode)
 *   6. Full autonomy: Phase 3 will enable direct on-chain execution
 *
 * Quorum: >= 4% of total $NOTARY supply must vote FOR (Gov Bravo pattern)
 */
contract Governance is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant GOV_ADMIN      = keccak256("GOV_ADMIN");
    bytes32 public constant EXECUTOR_ROLE  = keccak256("EXECUTOR_ROLE"); // Admin council
    bytes32 public constant GUARDIAN_ROLE  = keccak256("GUARDIAN_ROLE"); // Emergency cancel

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant BASIS_POINTS     = 10_000;
    uint256 public constant TIMELOCK_DELAY   = 48 hours;
    uint256 public constant MIN_VOTING_DELAY = 1 days;
    uint256 public constant MAX_VOTING_DELAY = 7 days;
    uint256 public constant MIN_VOTING_PERIOD = 3 days;
    uint256 public constant MAX_VOTING_PERIOD = 14 days;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum ProposalState {
        PENDING,    // Voting not started yet
        ACTIVE,     // Voting in progress
        CANCELLED,  // Cancelled before execution
        DEFEATED,   // Did not meet quorum or majority
        SUCCEEDED,  // Passed, not yet queued
        QUEUED,     // In timelock
        EXECUTED,   // Executed successfully
        EXPIRED     // Queued but not executed in time
    }

    enum ProposalCategory {
        PROTOCOL_UPGRADE,
        FEE_CHANGE,
        POLICY_CHANGE,
        TREASURY_SPEND,
        JURISDICTION_ADD,
        ORACLE_CHANGE,
        EMERGENCY,
        OTHER
    }

    enum VoteType { AGAINST, FOR, ABSTAIN }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Proposal {
        uint256           proposalId;
        address           proposer;
        ProposalCategory  category;
        string            description;
        string            ipfsCid;          // Full proposal text stored on IPFS
        uint256           votingStart;      // Timestamp when voting opens
        uint256           votingEnd;        // Timestamp when voting closes
        uint256           queuedAt;         // Timestamp when queued for execution
        uint256           executedAt;
        uint256           forVotes;
        uint256           againstVotes;
        uint256           abstainVotes;
        uint256           snapshotBlock;    // Block for vote weight snapshot
        ProposalState     state;
        bool              emergency;        // Emergency proposals skip delay
        // Execution target (optional — hybrid mode may use off-chain execution)
        address           target;
        bytes             callData;
        uint256           value;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _proposalIdCounter;

    ERC20Votes public votingToken; // $NOTARY token

    uint256 public votingDelay;      // Seconds between propose and voting start
    uint256 public votingPeriod;     // Seconds voting is open
    uint256 public proposalThreshold; // Min tokens to propose (absolute, not BP)
    uint256 public quorumBP;          // Minimum % of supply that must vote FOR (basis points)

    mapping(uint256 => Proposal) public proposals;
    // (proposalId, voter) → vote weight cast
    mapping(uint256 => mapping(address => uint256)) public voteWeights;
    mapping(uint256 => mapping(address => VoteType)) public voteChoices;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalCategory category,
        string description,
        uint256 votingStart,
        uint256 votingEnd
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteType voteType,
        uint256 weight,
        string reason
    );

    event ProposalQueued(uint256 indexed proposalId, uint256 executeAfter);
    event ProposalExecuted(uint256 indexed proposalId, address executor);
    event ProposalCancelled(uint256 indexed proposalId, address canceller);
    event ProposalDefeated(uint256 indexed proposalId);

    event GovernanceParameterUpdated(string param, uint256 oldValue, uint256 newValue);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param admin            Protocol admin (multi-sig)
     * @param _votingToken     $NOTARY ERC20Votes token address
     * @param _votingDelay     Delay before voting starts (seconds)
     * @param _votingPeriod    Duration of voting (seconds)
     * @param _proposalThreshold Minimum $NOTARY tokens to create a proposal
     * @param _quorumBP        Quorum as % of total supply in basis points (e.g. 400 = 4%)
     */
    constructor(
        address    admin,
        address    _votingToken,
        uint256    _votingDelay,
        uint256    _votingPeriod,
        uint256    _proposalThreshold,
        uint256    _quorumBP
    ) {
        require(admin        != address(0),    "Governance: zero admin");
        require(_votingToken != address(0),    "Governance: zero token");
        require(_votingDelay >= MIN_VOTING_DELAY && _votingDelay <= MAX_VOTING_DELAY, "Governance: bad delay");
        require(_votingPeriod >= MIN_VOTING_PERIOD && _votingPeriod <= MAX_VOTING_PERIOD, "Governance: bad period");
        require(_quorumBP    <= BASIS_POINTS,  "Governance: quorum > 100%");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOV_ADMIN,          admin);
        _grantRole(EXECUTOR_ROLE,      admin);
        _grantRole(GUARDIAN_ROLE,      admin);

        votingToken        = ERC20Votes(_votingToken);
        votingDelay        = _votingDelay;
        votingPeriod       = _votingPeriod;
        proposalThreshold  = _proposalThreshold;
        quorumBP           = _quorumBP;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Proposal Creation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a governance proposal.
     * @param category      Proposal classification
     * @param description   Short description (on-chain)
     * @param ipfsCid       IPFS CID of full proposal document
     * @param target        Contract to call on execution (address(0) = off-chain)
     * @param callData      Encoded function call (empty = off-chain execution)
     * @param value         ETH to send with call
     * @param emergency     Skip voting delay (requires GUARDIAN_ROLE)
     */
    function propose(
        ProposalCategory category,
        string calldata  description,
        string calldata  ipfsCid,
        address          target,
        bytes calldata   callData,
        uint256          value,
        bool             emergency
    ) external nonReentrant whenNotPaused returns (uint256 proposalId) {
        require(
            votingToken.getVotes(msg.sender) >= proposalThreshold,
            "Governance: insufficient voting power"
        );
        if (emergency) {
            require(hasRole(GUARDIAN_ROLE, msg.sender), "Governance: not guardian");
        }

        _proposalIdCounter.increment();
        proposalId = _proposalIdCounter.current();

        uint256 delay = emergency ? 0 : votingDelay;
        uint256 start = block.timestamp + delay;
        uint256 end   = start + votingPeriod;

        proposals[proposalId] = Proposal({
            proposalId:     proposalId,
            proposer:       msg.sender,
            category:       category,
            description:    description,
            ipfsCid:        ipfsCid,
            votingStart:    start,
            votingEnd:      end,
            queuedAt:       0,
            executedAt:     0,
            forVotes:       0,
            againstVotes:   0,
            abstainVotes:   0,
            snapshotBlock:  block.number,
            state:          ProposalState.PENDING,
            emergency:      emergency,
            target:         target,
            callData:       callData,
            value:          value
        });

        emit ProposalCreated(proposalId, msg.sender, category, description, start, end);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Voting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Cast a vote on a proposal.
     * @param proposalId The proposal to vote on
     * @param voteType   FOR, AGAINST, or ABSTAIN
     * @param reason     Optional reason string (emitted in event)
     */
    function castVote(
        uint256  proposalId,
        VoteType voteType,
        string calldata reason
    ) external nonReentrant {
        Proposal storage p = _requireProposal(proposalId);
        require(block.timestamp >= p.votingStart, "Governance: voting not started");
        require(block.timestamp <= p.votingEnd,   "Governance: voting ended");
        require(!hasVoted[proposalId][msg.sender],"Governance: already voted");
        _syncState(p);
        require(p.state == ProposalState.ACTIVE,  "Governance: not active");

        uint256 weight = votingToken.getPastVotes(msg.sender, p.snapshotBlock);
        require(weight > 0, "Governance: no voting power");

        hasVoted[proposalId][msg.sender]   = true;
        voteWeights[proposalId][msg.sender] = weight;
        voteChoices[proposalId][msg.sender] = voteType;

        if (voteType == VoteType.FOR)     p.forVotes     += weight;
        else if (voteType == VoteType.AGAINST) p.againstVotes += weight;
        else                              p.abstainVotes += weight;

        emit VoteCast(proposalId, msg.sender, voteType, weight, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Execution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Queue a succeeded proposal for execution (starts timelock).
     */
    function queue(uint256 proposalId) external nonReentrant {
        Proposal storage p = _requireProposal(proposalId);
        _syncState(p);
        require(p.state == ProposalState.SUCCEEDED, "Governance: proposal not succeeded");

        p.state    = ProposalState.QUEUED;
        p.queuedAt = block.timestamp;

        emit ProposalQueued(proposalId, block.timestamp + TIMELOCK_DELAY);
    }

    /**
     * @notice Execute a queued proposal after timelock. Hybrid: admin council executes.
     */
    function execute(uint256 proposalId) external payable nonReentrant onlyRole(EXECUTOR_ROLE) {
        Proposal storage p = _requireProposal(proposalId);
        require(p.state == ProposalState.QUEUED,                    "Governance: not queued");
        require(block.timestamp >= p.queuedAt + TIMELOCK_DELAY,     "Governance: timelock active");
        require(block.timestamp <= p.queuedAt + TIMELOCK_DELAY + 14 days, "Governance: expired");

        p.state      = ProposalState.EXECUTED;
        p.executedAt = block.timestamp;

        // Execute on-chain call if target specified
        if (p.target != address(0) && p.callData.length > 0) {
            (bool success, bytes memory returnData) = p.target.call{value: p.value}(p.callData);
            require(success, string(abi.encodePacked("Governance: execution failed: ", returnData)));
        }

        emit ProposalExecuted(proposalId, msg.sender);
    }

    /**
     * @notice Cancel a proposal. Proposer can cancel if not yet executed; guardian always can.
     */
    function cancel(uint256 proposalId) external nonReentrant {
        Proposal storage p = _requireProposal(proposalId);
        require(
            msg.sender == p.proposer || hasRole(GUARDIAN_ROLE, msg.sender),
            "Governance: not authorized"
        );
        require(
            p.state != ProposalState.EXECUTED && p.state != ProposalState.CANCELLED,
            "Governance: cannot cancel"
        );
        p.state = ProposalState.CANCELLED;
        emit ProposalCancelled(proposalId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function proposalState(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];
        return _computeState(p);
    }

    function quorumVotes() public view returns (uint256) {
        return (votingToken.totalSupply() * quorumBP) / BASIS_POINTS;
    }

    function hasReachedQuorum(uint256 proposalId) public view returns (bool) {
        return proposals[proposalId].forVotes >= quorumVotes();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setVotingDelay(uint256 delay) external onlyRole(GOV_ADMIN) {
        require(delay >= MIN_VOTING_DELAY && delay <= MAX_VOTING_DELAY, "Governance: bad delay");
        emit GovernanceParameterUpdated("votingDelay", votingDelay, delay);
        votingDelay = delay;
    }

    function setVotingPeriod(uint256 period) external onlyRole(GOV_ADMIN) {
        require(period >= MIN_VOTING_PERIOD && period <= MAX_VOTING_PERIOD, "Governance: bad period");
        emit GovernanceParameterUpdated("votingPeriod", votingPeriod, period);
        votingPeriod = period;
    }

    function setProposalThreshold(uint256 threshold) external onlyRole(GOV_ADMIN) {
        emit GovernanceParameterUpdated("proposalThreshold", proposalThreshold, threshold);
        proposalThreshold = threshold;
    }

    function setQuorum(uint256 _quorumBP) external onlyRole(GOV_ADMIN) {
        require(_quorumBP <= BASIS_POINTS, "Governance: quorum > 100%");
        emit GovernanceParameterUpdated("quorumBP", quorumBP, _quorumBP);
        quorumBP = _quorumBP;
    }

    function pause()   external onlyRole(GOV_ADMIN) { _pause(); }
    function unpause() external onlyRole(GOV_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _requireProposal(uint256 proposalId) internal view returns (Proposal storage p) {
        p = proposals[proposalId];
        require(p.proposalId != 0, "Governance: not found");
    }

    function _syncState(Proposal storage p) internal {
        ProposalState computed = _computeState(p);
        if (computed != p.state) p.state = computed;
    }

    function _computeState(Proposal storage p) internal view returns (ProposalState) {
        if (p.state == ProposalState.CANCELLED ||
            p.state == ProposalState.EXECUTED) return p.state;

        if (block.timestamp < p.votingStart) return ProposalState.PENDING;
        if (block.timestamp <= p.votingEnd)  return ProposalState.ACTIVE;

        // Voting ended
        if (p.forVotes <= p.againstVotes || !hasReachedQuorum(p.proposalId)) {
            return ProposalState.DEFEATED;
        }
        if (p.state == ProposalState.QUEUED) {
            if (block.timestamp > p.queuedAt + TIMELOCK_DELAY + 14 days) {
                return ProposalState.EXPIRED;
            }
            return ProposalState.QUEUED;
        }
        return ProposalState.SUCCEEDED;
    }

    receive() external payable {}
}
