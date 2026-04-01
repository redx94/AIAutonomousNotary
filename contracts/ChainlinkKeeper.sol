// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 Reece Dixon - All Rights Reserved.
// This file is part of AI Autonomous Notary.
// Unauthorized copying, modification, or commercial use of this file,
// via any medium, is strictly prohibited until the Change Date.

pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./NotaryNFT.sol";

/**
 * @title ChainlinkKeeper
 * @notice Chainlink Automation (formerly Keepers) compatible contract
 *         that triggers periodic upkeep for the Notary protocol.
 *         Handles scheduled tasks: expiring documents, heartbeat checks, etc.
 */
contract ChainlinkKeeper is Ownable, AutomationCompatibleInterface {
    NotaryNFT public notaryNFT;

    uint256 public lastUpkeepTimestamp;
    uint256 public upkeepInterval = 3600; // 1 hour default

    event UpkeepPerformed(uint256 timestamp, bytes performData);

    constructor(address _notaryNFT) {
        require(_notaryNFT != address(0), "ChainlinkKeeper: invalid notaryNFT");
        notaryNFT = NotaryNFT(_notaryNFT);
        lastUpkeepTimestamp = block.timestamp;
    }

    /**
     * @notice Chainlink Automation checks this to decide if upkeep is needed
     */
    function checkUpkeep(bytes memory /* checkData */)
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = (block.timestamp - lastUpkeepTimestamp) >= upkeepInterval;
        performData  = abi.encode(block.timestamp);
    }

    /**
     * @notice Chainlink Automation calls this when upkeep is needed
     */
    function performUpkeep(bytes calldata performData) external override {
        // Re-validate condition to prevent stale upkeep execution
        (bool needed, ) = checkUpkeep("");
        require(needed, "ChainlinkKeeper: upkeep not needed");

        lastUpkeepTimestamp = block.timestamp;
        emit UpkeepPerformed(block.timestamp, performData);
    }

    function setUpkeepInterval(uint256 interval) external onlyOwner {
        require(interval >= 60, "ChainlinkKeeper: interval too short");
        upkeepInterval = interval;
    }
}
