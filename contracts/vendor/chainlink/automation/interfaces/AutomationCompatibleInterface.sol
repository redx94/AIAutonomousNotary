// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal local copy of Chainlink Automation's upkeep interface.
 * @dev This preserves the protocol's keeper compatibility without pulling the
 *      entire Chainlink contracts package into the dependency graph.
 */
interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external
        returns (bool upkeepNeeded, bytes memory performData);

    function performUpkeep(bytes calldata performData) external;
}
