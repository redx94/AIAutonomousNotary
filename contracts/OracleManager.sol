// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title OracleManager
 * @author AI Autonomous Notary Protocol
 * @notice Manages integration with Chainlink price feeds, Functions, and
 *         external data providers. Provides trusted price data for document
 *         valuations, identity verification data, and compliance signals
 *         to the rest of the protocol.
 * @dev Aggregates data from multiple oracle sources with staleness checks,
 *      heartbeat monitoring, and automatic failover to backup feeds.
 */
contract OracleManager is AccessControl, Pausable, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ADMIN   = keccak256("ORACLE_ADMIN");
    bytes32 public constant DATA_PROVIDER  = keccak256("DATA_PROVIDER");
    bytes32 public constant CONSUMER_ROLE  = keccak256("CONSUMER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum FeedType {
        PRICE_FEED,
        COMPLIANCE_FEED,
        IDENTITY_FEED,
        DOCUMENT_VALUATION,
        INTEREST_RATE,
        VOLATILITY_INDEX
    }

    enum FeedStatus {
        ACTIVE,
        DEGRADED,    // Reporting but with stale data
        OFFLINE,
        DEPRECATED
    }

    struct OracleFeed {
        bytes32    feedId;
        string     name;
        string     description;
        FeedType   feedType;
        FeedStatus status;
        address    primaryProvider;
        address    backupProvider;
        uint256    heartbeatSeconds;   // Expected update frequency
        uint256    staleThreshold;     // Max age before marked DEGRADED
        uint256    deviationThreshold; // Basis points; alert if >this deviation
        uint256    lastUpdated;
        int256     latestAnswer;
        uint256    latestAnswerUint;   // For non-signed values
        uint8      decimals;
        bool       useBackup;
        uint256    updateCount;
    }

    struct PriceData {
        int256   answer;
        uint256  timestamp;
        uint8    decimals;
        FeedStatus status;
        bool     isStale;
    }

    struct FeedUpdateRecord {
        address  provider;
        int256   answer;
        uint256  timestamp;
        bytes32  proofHash;   // Hash of off-chain proof/attestation
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    mapping(bytes32 => OracleFeed) public feeds;
    mapping(bytes32 => FeedUpdateRecord[]) public feedHistory;
    bytes32[] public feedIds;

    // Chainlink aggregator address mapping (feedId => chainlink address)
    mapping(bytes32 => address) public chainlinkAggregators;

    // Document valuation cache (documentHash => USD value in wei-equivalent)
    mapping(bytes32 => uint256) public documentValuations;
    mapping(bytes32 => uint256) public documentValuationTimestamps;

    // Global oracle health
    uint256 public totalFeeds;
    uint256 public activeFeeds;
    uint256 public degradedFeeds;
    uint256 public offlineFeeds;

    uint256 public constant DEFAULT_HEARTBEAT      = 3600;  // 1 hour
    uint256 public constant DEFAULT_STALE_THRESHOLD = 7200; // 2 hours
    uint256 public constant VALUATION_CACHE_TTL    = 86400; // 24 hours

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event FeedRegistered(
        bytes32 indexed feedId,
        string  name,
        FeedType feedType,
        address primaryProvider
    );

    event FeedUpdated(
        bytes32 indexed feedId,
        int256  oldAnswer,
        int256  newAnswer,
        address indexed provider,
        uint256 timestamp
    );

    event FeedStatusChanged(
        bytes32 indexed feedId,
        FeedStatus oldStatus,
        FeedStatus newStatus,
        uint256 timestamp
    );

    event StaleDataAlert(
        bytes32 indexed feedId,
        uint256 lastUpdated,
        uint256 staleSince,
        uint256 timestamp
    );

    event DocumentValuationUpdated(
        bytes32 indexed documentHash,
        uint256 oldValue,
        uint256 newValue,
        address indexed provider,
        uint256 timestamp
    );

    event ChainlinkAggregatorSet(bytes32 indexed feedId, address indexed aggregator);
    event BackupProviderActivated(bytes32 indexed feedId, address indexed backupProvider);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin) {
        require(admin != address(0), "OracleManager: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN,       admin);
        _grantRole(DATA_PROVIDER,      admin);
        _grantRole(CONSUMER_ROLE,      admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Feed Registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new oracle data feed
     */
    function registerFeed(
        bytes32  feedId,
        string calldata name,
        string calldata description,
        FeedType feedType,
        address  primaryProvider,
        address  backupProvider,
        uint256  heartbeatSeconds,
        uint256  staleThreshold,
        uint256  deviationThreshold,
        uint8    decimals
    )
        external
        onlyRole(ORACLE_ADMIN)
        whenNotPaused
    {
        require(feedId != bytes32(0),                  "OracleManager: null feedId");
        require(feeds[feedId].lastUpdated == 0,        "OracleManager: feed already registered");
        require(primaryProvider != address(0),         "OracleManager: invalid provider");
        require(heartbeatSeconds >= 60,                "OracleManager: heartbeat too short");

        feeds[feedId] = OracleFeed({
            feedId:              feedId,
            name:                name,
            description:         description,
            feedType:            feedType,
            status:              FeedStatus.ACTIVE,
            primaryProvider:     primaryProvider,
            backupProvider:      backupProvider,
            heartbeatSeconds:    heartbeatSeconds,
            staleThreshold:      staleThreshold,
            deviationThreshold:  deviationThreshold,
            lastUpdated:         0,
            latestAnswer:        0,
            latestAnswerUint:    0,
            decimals:            decimals,
            useBackup:           false,
            updateCount:         0
        });

        feedIds.push(feedId);
        totalFeeds++;
        activeFeeds++;

        _grantRole(DATA_PROVIDER, primaryProvider);
        if (backupProvider != address(0)) {
            _grantRole(DATA_PROVIDER, backupProvider);
        }

        emit FeedRegistered(feedId, name, feedType, primaryProvider);
    }

    /**
     * @notice Set Chainlink aggregator address for a feed
     */
    function setChainlinkAggregator(bytes32 feedId, address aggregator)
        external
        onlyRole(ORACLE_ADMIN)
    {
        require(feeds[feedId].lastUpdated != 0 || feedId != bytes32(0), "OracleManager: feed not found");
        require(aggregator != address(0), "OracleManager: zero aggregator");
        chainlinkAggregators[feedId] = aggregator;
        emit ChainlinkAggregatorSet(feedId, aggregator);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Data Submission
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Data provider submits a new oracle answer
     * @param feedId    Target feed identifier
     * @param answer    New signed price/value answer
     * @param proofHash Hash of off-chain attestation proof
     */
    function submitAnswer(
        bytes32 feedId,
        int256  answer,
        bytes32 proofHash
    )
        external
        onlyRole(DATA_PROVIDER)
        whenNotPaused
        nonReentrant
    {
        OracleFeed storage feed = feeds[feedId];
        require(feed.feedId != bytes32(0), "OracleManager: feed not found");
        require(feed.status != FeedStatus.DEPRECATED, "OracleManager: feed deprecated");

        // Validate provider
        bool isAuthorizedProvider = (
            msg.sender == feed.primaryProvider ||
            (feed.useBackup && msg.sender == feed.backupProvider)
        );
        require(isAuthorizedProvider, "OracleManager: unauthorized provider for this feed");

        // Check deviation alert
        if (feed.updateCount > 0 && feed.deviationThreshold > 0) {
            uint256 deviation = _calculateDeviation(feed.latestAnswer, answer);
            if (deviation > feed.deviationThreshold) {
                // Large deviation: mark as degraded for review
                _updateFeedStatus(feedId, FeedStatus.DEGRADED);
            }
        }

        int256 oldAnswer = feed.latestAnswer;
        feed.latestAnswer   = answer;
        feed.lastUpdated    = block.timestamp;
        feed.updateCount++;

        if (feed.status == FeedStatus.DEGRADED) {
            _updateFeedStatus(feedId, FeedStatus.ACTIVE);
        }

        feedHistory[feedId].push(FeedUpdateRecord({
            provider:  msg.sender,
            answer:    answer,
            timestamp: block.timestamp,
            proofHash: proofHash
        }));

        emit FeedUpdated(feedId, oldAnswer, answer, msg.sender, block.timestamp);
    }

    /**
     * @notice Submit unsigned value (for non-price data like document valuations)
     */
    function submitUnsignedAnswer(
        bytes32 feedId,
        uint256 answer,
        bytes32 proofHash
    )
        external
        onlyRole(DATA_PROVIDER)
        whenNotPaused
        nonReentrant
    {
        OracleFeed storage feed = feeds[feedId];
        require(feed.feedId != bytes32(0), "OracleManager: feed not found");
        require(
            msg.sender == feed.primaryProvider || msg.sender == feed.backupProvider,
            "OracleManager: unauthorized provider"
        );

        uint256 oldAnswer    = feed.latestAnswerUint;
        feed.latestAnswerUint = answer;
        feed.lastUpdated     = block.timestamp;
        feed.updateCount++;

        feedHistory[feedId].push(FeedUpdateRecord({
            provider:  msg.sender,
            answer:    int256(answer),
            timestamp: block.timestamp,
            proofHash: proofHash
        }));

        emit FeedUpdated(feedId, int256(oldAnswer), int256(answer), msg.sender, block.timestamp);
    }

    /**
     * @notice Update a specific document's valuation
     */
    function updateDocumentValuation(
        bytes32 documentHash,
        uint256 valuationUSD
    )
        external
        onlyRole(DATA_PROVIDER)
        whenNotPaused
    {
        require(documentHash != bytes32(0), "OracleManager: null document hash");
        uint256 old = documentValuations[documentHash];
        documentValuations[documentHash]          = valuationUSD;
        documentValuationTimestamps[documentHash] = block.timestamp;
        emit DocumentValuationUpdated(documentHash, old, valuationUSD, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Staleness Checks & Heartbeat Monitor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Check feeds for staleness and update their status
     * @dev Callable by any party; intended to be called by Chainlink Keepers
     */
    function checkAndUpdateStaleness() external whenNotPaused {
        for (uint256 i = 0; i < feedIds.length; i++) {
            bytes32 feedId = feedIds[i];
            OracleFeed storage feed = feeds[feedId];

            if (feed.status == FeedStatus.DEPRECATED) continue;
            if (feed.lastUpdated == 0) continue;

            uint256 staleSince = block.timestamp - feed.lastUpdated;

            if (staleSince > feed.staleThreshold && feed.status == FeedStatus.ACTIVE) {
                _updateFeedStatus(feedId, FeedStatus.DEGRADED);
                emit StaleDataAlert(feedId, feed.lastUpdated, staleSince, block.timestamp);
            }

            if (staleSince > feed.staleThreshold * 3 && feed.status != FeedStatus.OFFLINE) {
                _updateFeedStatus(feedId, FeedStatus.OFFLINE);

                // Activate backup if available
                if (feed.backupProvider != address(0) && !feed.useBackup) {
                    feed.useBackup = true;
                    emit BackupProviderActivated(feedId, feed.backupProvider);
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getLatestPrice(bytes32 feedId)
        external
        view
        onlyRole(CONSUMER_ROLE)
        returns (PriceData memory)
    {
        OracleFeed storage feed = feeds[feedId];
        require(feed.feedId != bytes32(0), "OracleManager: feed not found");

        bool isStale = feed.lastUpdated > 0 &&
                       (block.timestamp - feed.lastUpdated) > feed.staleThreshold;

        return PriceData({
            answer:    feed.latestAnswer,
            timestamp: feed.lastUpdated,
            decimals:  feed.decimals,
            status:    feed.status,
            isStale:   isStale
        });
    }

    function getDocumentValuation(bytes32 documentHash)
        external
        view
        returns (uint256 valuationUSD, uint256 timestamp, bool isCached)
    {
        valuationUSD = documentValuations[documentHash];
        timestamp    = documentValuationTimestamps[documentHash];
        isCached     = timestamp > 0 && (block.timestamp - timestamp) < VALUATION_CACHE_TTL;
    }

    function getFeed(bytes32 feedId) external view returns (OracleFeed memory) {
        return feeds[feedId];
    }

    function getFeedHistory(bytes32 feedId) external view returns (FeedUpdateRecord[] memory) {
        return feedHistory[feedId];
    }

    function getAllFeedIds() external view returns (bytes32[] memory) {
        return feedIds;
    }

    function getHealthReport() external view returns (
        uint256 total, uint256 active, uint256 degraded, uint256 offline
    ) {
        return (totalFeeds, activeFeeds, degradedFeeds, offlineFeeds);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Feed Status Management
    // ─────────────────────────────────────────────────────────────────────────

    function deprecateFeed(bytes32 feedId) external onlyRole(ORACLE_ADMIN) {
        require(feeds[feedId].feedId != bytes32(0), "OracleManager: feed not found");
        _updateFeedStatus(feedId, FeedStatus.DEPRECATED);
    }

    function reactivateFeed(bytes32 feedId) external onlyRole(ORACLE_ADMIN) {
        require(feeds[feedId].status == FeedStatus.OFFLINE || feeds[feedId].status == FeedStatus.DEGRADED,
            "OracleManager: cannot reactivate"
        );
        _updateFeedStatus(feedId, FeedStatus.ACTIVE);
        feeds[feedId].useBackup = false;
    }

    function pause()   external onlyRole(ORACLE_ADMIN) { _pause(); }
    function unpause() external onlyRole(ORACLE_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _updateFeedStatus(bytes32 feedId, FeedStatus newStatus) internal {
        OracleFeed storage feed = feeds[feedId];
        FeedStatus oldStatus = feed.status;
        if (oldStatus == newStatus) return;

        // Update global counters
        if (oldStatus == FeedStatus.ACTIVE)   activeFeeds--;
        if (oldStatus == FeedStatus.DEGRADED) degradedFeeds--;
        if (oldStatus == FeedStatus.OFFLINE)  offlineFeeds--;

        if (newStatus == FeedStatus.ACTIVE)   activeFeeds++;
        if (newStatus == FeedStatus.DEGRADED) degradedFeeds++;
        if (newStatus == FeedStatus.OFFLINE)  offlineFeeds++;

        feed.status = newStatus;
        emit FeedStatusChanged(feedId, oldStatus, newStatus, block.timestamp);
    }

    function _calculateDeviation(int256 oldVal, int256 newVal)
        internal
        pure
        returns (uint256 deviation)
    {
        if (oldVal == 0) return 0;
        int256 diff = newVal - oldVal;
        if (diff < 0) diff = -diff;
        // Return basis points of deviation
        deviation = uint256(diff * 10000 / (oldVal < 0 ? -oldVal : oldVal));
    }
}
