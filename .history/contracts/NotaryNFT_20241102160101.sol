pragma solidity ^0.8.0;

// SPDX-License-Identifier: MIT

import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

contract NotaryNFT is KeeperCompatibleInterface, VRFConsumerBase {
    // ... (rest of your contract code)
}
