// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ValidationOracle
 * @author AI Autonomous Notary Protocol
 * @notice Decentralized verification consensus layer. Multiple independent
 *         validator nodes stake reputation and collectively determine document
 *         authenticity through a Byzantine fault-tolerant voting mechanism.
 * @dev Validators earn reputation for accurate votes and lose reputation for
 *      inaccurate or delayed responses. Result is a weighted consensus score
 *      incorporating validator reputation as vote weight.
 */
contract ValidationOracle is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ADMIN    = keccak256("ORACLE_ADMIN");
    bytes32 public constant VALIDATOR_ROLE  = keccak256("VALIDATOR_ROLE");
    bytes32 public constant SLASHER_ROLE    = keccak256("SLASHER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant MAX_REPUTATION       = 10_000;
    uint256 public constant INITIAL_REPUTATION   = 5_000;
    uint256 public constant MIN_REPUTATION       = 100;
    uint256 public constant REPUTATION_GAIN      = 50;
    uint256 public constant REPUTATION_SLASH     = 200;
    uint256 public constant VOTE_WINDOW          = 2 hours;
    uint256 public constant REVEAL_WINDOW        = 30 minutes;

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum ConsensusResult {
        PENDING,
        APPROVED,
        REJECTED,
        INCONCLUSIVE
    }

    enum VoteValue {
        APPROVE,
        REJECT,
        ABSTAIN
    }

    struct ValidatorInfo {
        address  validatorAddress;
        uint256  reputation;      // 0-10000 score
        uint256  totalVotes;
        uint256  correctVotes;
        uint256  slashCount;
        uint256  joinedAt;
        bool     isActive;
        bool     isSlashed;       // Permanently removed from pool
    }

    struct VotingRound {
        uint256          roundId;
        bytes32          documentHash;
        address          requester;
        uint256          startTime;
        uint256          commitDeadline;   // End of commit phase
        uint256          revealDeadline;   // End of reveal phase
        ConsensusResult  result;
        uint256          totalWeightedVotes;
        uint256          approveWeight;
        uint256          rejectWeight;
        uint256          abstainWeight;
        uint256          participantCount;
        bool             finalized;
        uint256          finalConsensusScore; // 0-10000 weighted consensus
    }

    struct CommitVote {
        bytes32 commitment;   // keccak256(voteValue, salt, validatorAddress)
        uint256 committedAt;
        bool    revealed;
        VoteValue revealedVote;
        uint256  revealedAt;
        uint256  weight;     // Reputation at time of vote
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _roundIdCounter;

    mapping(address => ValidatorInfo) public validators;
    address[] public validatorPool;

    mapping(uint256 => VotingRound) public rounds;
    mapping(uint256 => mapping(address => CommitVote)) public votes;
    mapping(bytes32 => uint256) public documentHashToRoundId;

    uint256 public minValidators         = 3;
    uint256 public consensusThresholdBP  = 6000; // 60% weighted vote required
    uint256 public minConsensusScore     = 5500;  // Minimum score to approve

    // Stats
    uint256 public totalRounds;
    uint256 public totalApproved;
    uint256 public totalRejected;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ValidatorRegistered(address indexed validator, uint256 initialReputation);
    event ValidatorSlashed(address indexed validator, uint256 penaltyAmount, string reason);
    event ValidatorReputationUpdated(address indexed validator, uint256 oldRep, uint256 newRep);

    event VotingRoundCreated(
        uint256 indexed roundId,
        bytes32 indexed documentHash,
        address indexed requester,
        uint256 commitDeadline,
        uint256 revealDeadline
    );

    event VoteCommitted(uint256 indexed roundId, address indexed validator, uint256 timestamp);
    event VoteRevealed(uint256 indexed roundId, address indexed validator, VoteValue vote, uint256 weight);

    event ConsensusReached(
        uint256 indexed roundId,
        bytes32 indexed documentHash,
        ConsensusResult result,
        uint256 consensusScore,
        uint256 approveWeight,
        uint256 rejectWeight
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, address[] memory initialValidators) {
        require(admin != address(0), "ValidationOracle: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN,       admin);
        _grantRole(SLASHER_ROLE,       admin);

        for (uint256 i = 0; i < initialValidators.length; i++) {
            _registerValidator(initialValidators[i]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validator Management
    // ─────────────────────────────────────────────────────────────────────────

    function registerValidator(address validator)
        external
        onlyRole(ORACLE_ADMIN)
        whenNotPaused
    {
        require(validator != address(0),          "ValidationOracle: zero address");
        require(!validators[validator].isActive,  "ValidationOracle: already registered");
        _registerValidator(validator);
    }

    function slashValidator(address validator, string calldata reason)
        external
        onlyRole(SLASHER_ROLE)
    {
        ValidatorInfo storage v = validators[validator];
        require(v.isActive,   "ValidationOracle: not active");
        require(!v.isSlashed, "ValidationOracle: already slashed");

        uint256 oldRep = v.reputation;
        uint256 penalty = REPUTATION_SLASH * 5; // Major slash
        v.reputation = v.reputation > penalty ? v.reputation - penalty : MIN_REPUTATION;
        v.slashCount++;

        if (v.slashCount >= 3 || v.reputation <= MIN_REPUTATION) {
            v.isActive  = false;
            v.isSlashed = true;
            _revokeRole(VALIDATOR_ROLE, validator);
        }

        emit ValidatorSlashed(validator, penalty, reason);
        emit ValidatorReputationUpdated(validator, oldRep, v.reputation);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Voting (Commit-Reveal Scheme)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new voting round for a document
     * @param documentHash  Hash of the document to validate
     * @return roundId      Unique voting round identifier
     */
    function createVotingRound(bytes32 documentHash)
        external
        onlyRole(ORACLE_ADMIN)
        whenNotPaused
        returns (uint256 roundId)
    {
        require(documentHash != bytes32(0),               "ValidationOracle: null hash");
        require(documentHashToRoundId[documentHash] == 0, "ValidationOracle: round already exists");
        require(validatorPool.length >= minValidators,    "ValidationOracle: insufficient validators");

        _roundIdCounter.increment();
        roundId = _roundIdCounter.current();
        totalRounds++;

        uint256 commitDeadline = block.timestamp + VOTE_WINDOW;
        uint256 revealDeadline = commitDeadline + REVEAL_WINDOW;

        rounds[roundId] = VotingRound({
            roundId:             roundId,
            documentHash:        documentHash,
            requester:           msg.sender,
            startTime:           block.timestamp,
            commitDeadline:      commitDeadline,
            revealDeadline:      revealDeadline,
            result:              ConsensusResult.PENDING,
            totalWeightedVotes:  0,
            approveWeight:       0,
            rejectWeight:        0,
            abstainWeight:       0,
            participantCount:    0,
            finalized:           false,
            finalConsensusScore: 0
        });

        documentHashToRoundId[documentHash] = roundId;

        emit VotingRoundCreated(roundId, documentHash, msg.sender, commitDeadline, revealDeadline);
    }

    /**
     * @notice Commit a hashed vote (commit phase)
     * @param roundId    Target voting round
     * @param commitment keccak256(abi.encodePacked(voteValue, salt, msg.sender))
     */
    function commitVote(uint256 roundId, bytes32 commitment)
        external
        onlyRole(VALIDATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(validators[msg.sender].isActive,           "ValidationOracle: validator not active");
        VotingRound storage round = rounds[roundId];
        require(round.roundId != 0,                        "ValidationOracle: round does not exist");
        require(block.timestamp <= round.commitDeadline,   "ValidationOracle: commit phase closed");
        require(votes[roundId][msg.sender].committedAt == 0, "ValidationOracle: already committed");

        votes[roundId][msg.sender] = CommitVote({
            commitment:    commitment,
            committedAt:   block.timestamp,
            revealed:      false,
            revealedVote:  VoteValue.ABSTAIN,
            revealedAt:    0,
            weight:        validators[msg.sender].reputation
        });

        round.participantCount++;
        emit VoteCommitted(roundId, msg.sender, block.timestamp);
    }

    /**
     * @notice Reveal a committed vote (reveal phase)
     * @param roundId   Target voting round
     * @param vote      The actual vote value (must match commitment)
     * @param salt      The salt used in the commitment hash
     */
    function revealVote(uint256 roundId, VoteValue vote, bytes32 salt)
        external
        onlyRole(VALIDATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        VotingRound storage round = rounds[roundId];
        require(round.roundId != 0,                           "ValidationOracle: round does not exist");
        require(block.timestamp > round.commitDeadline,       "ValidationOracle: commit phase still open");
        require(block.timestamp <= round.revealDeadline,      "ValidationOracle: reveal phase closed");

        CommitVote storage cv = votes[roundId][msg.sender];
        require(cv.committedAt > 0,  "ValidationOracle: no commit found");
        require(!cv.revealed,        "ValidationOracle: already revealed");

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(uint8(vote), salt, msg.sender));
        require(cv.commitment == expectedCommitment, "ValidationOracle: commitment mismatch");

        cv.revealed      = true;
        cv.revealedVote  = vote;
        cv.revealedAt    = block.timestamp;

        uint256 weight = cv.weight; // Weight set at commit time
        round.totalWeightedVotes += weight;

        if (vote == VoteValue.APPROVE) {
            round.approveWeight += weight;
        } else if (vote == VoteValue.REJECT) {
            round.rejectWeight += weight;
        } else {
            round.abstainWeight += weight;
        }

        emit VoteRevealed(roundId, msg.sender, vote, weight);
    }

    /**
     * @notice Finalize the voting round and compute consensus
     * @param roundId Target voting round
     */
    function finalizeRound(uint256 roundId) external whenNotPaused nonReentrant {
        VotingRound storage round = rounds[roundId];
        require(round.roundId != 0,           "ValidationOracle: round does not exist");
        require(!round.finalized,             "ValidationOracle: already finalized");
        require(block.timestamp > round.revealDeadline, "ValidationOracle: reveal phase not closed");

        ConsensusResult result;
        uint256 consensusScore;

        if (round.totalWeightedVotes == 0) {
            result = ConsensusResult.INCONCLUSIVE;
            consensusScore = 0;
        } else {
            uint256 approvePercentBP = (round.approveWeight * 10000) / round.totalWeightedVotes;
            uint256 rejectPercentBP  = (round.rejectWeight  * 10000) / round.totalWeightedVotes;
            consensusScore = approvePercentBP;

            if (approvePercentBP >= consensusThresholdBP && consensusScore >= minConsensusScore) {
                result = ConsensusResult.APPROVED;
                totalApproved++;
            } else if (rejectPercentBP >= consensusThresholdBP) {
                result = ConsensusResult.REJECTED;
                totalRejected++;
            } else {
                result = ConsensusResult.INCONCLUSIVE;
            }
        }

        round.result             = result;
        round.finalized          = true;
        round.finalConsensusScore = consensusScore;

        // Update validator reputations
        _updateValidatorReputations(roundId, result);

        emit ConsensusReached(
            roundId,
            round.documentHash,
            result,
            consensusScore,
            round.approveWeight,
            round.rejectWeight
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getRound(uint256 roundId) external view returns (VotingRound memory) {
        return rounds[roundId];
    }

    function getValidatorInfo(address validator) external view returns (ValidatorInfo memory) {
        return validators[validator];
    }

    function getVote(uint256 roundId, address validator)
        external
        view
        returns (CommitVote memory)
    {
        return votes[roundId][validator];
    }

    function getValidatorPool() external view returns (address[] memory) {
        return validatorPool;
    }

    function getRoundByDocument(bytes32 documentHash) external view returns (VotingRound memory) {
        return rounds[documentHashToRoundId[documentHash]];
    }

    function isRoundFinalized(uint256 roundId) external view returns (bool) {
        return rounds[roundId].finalized;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setMinValidators(uint256 min) external onlyRole(ORACLE_ADMIN) {
        require(min >= 1, "ValidationOracle: min must be at least 1");
        minValidators = min;
    }

    function setConsensusThreshold(uint256 basisPoints) external onlyRole(ORACLE_ADMIN) {
        require(basisPoints >= 5100 && basisPoints <= 10000, "ValidationOracle: invalid threshold");
        consensusThresholdBP = basisPoints;
    }

    function pause()   external onlyRole(ORACLE_ADMIN) { _pause(); }
    function unpause() external onlyRole(ORACLE_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _registerValidator(address validator) internal {
        validators[validator] = ValidatorInfo({
            validatorAddress: validator,
            reputation:       INITIAL_REPUTATION,
            totalVotes:       0,
            correctVotes:     0,
            slashCount:       0,
            joinedAt:         block.timestamp,
            isActive:         true,
            isSlashed:        false
        });
        validatorPool.push(validator);
        _grantRole(VALIDATOR_ROLE, validator);
        emit ValidatorRegistered(validator, INITIAL_REPUTATION);
    }

    function _updateValidatorReputations(uint256 roundId, ConsensusResult result) internal {
        if (result == ConsensusResult.INCONCLUSIVE) return;

        VoteValue winningVote = result == ConsensusResult.APPROVED
            ? VoteValue.APPROVE
            : VoteValue.REJECT;

        for (uint256 i = 0; i < validatorPool.length; i++) {
            address v = validatorPool[i];
            CommitVote storage cv = votes[roundId][v];

            if (!cv.revealed) continue;

            ValidatorInfo storage vi = validators[v];
            uint256 oldRep = vi.reputation;
            vi.totalVotes++;

            if (cv.revealedVote == winningVote) {
                vi.correctVotes++;
                vi.reputation = vi.reputation + REPUTATION_GAIN > MAX_REPUTATION
                    ? MAX_REPUTATION
                    : vi.reputation + REPUTATION_GAIN;
            } else if (cv.revealedVote != VoteValue.ABSTAIN) {
                vi.reputation = vi.reputation > REPUTATION_SLASH
                    ? vi.reputation - REPUTATION_SLASH
                    : MIN_REPUTATION;
            }

            if (vi.reputation != oldRep) {
                emit ValidatorReputationUpdated(v, oldRep, vi.reputation);
            }
        }
    }
}
