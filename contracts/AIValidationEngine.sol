// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 Reece Dixon - All Rights Reserved.
// This file is part of AI Autonomous Notary.
// Unauthorized copying, modification, or commercial use of this file,
// via any medium, is strictly prohibited until the Change Date.

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NotaryNFT.sol";

/**
 * @title AIValidationEngine (Legacy)
 * @notice Kept for historical reference. Superseded by AIEngine.sol in Phase 1.
 * @dev This is the original placeholder contract. Do not use in production.
 */
contract AIValidationEngine is AccessControl {
    address public immutable keeperContract;
    NotaryNFT public notaryNFT;

    event IdentityVerified(address indexed user, bool result);
    event DocumentValidated(bytes32 indexed documentHash, bool result);

    constructor(address _keeperContract, address _notaryNFT) {
        require(_keeperContract != address(0), "AIValidationEngine: invalid keeper");
        require(_notaryNFT != address(0),      "AIValidationEngine: invalid notaryNFT");
        keeperContract = _keeperContract;
        notaryNFT      = NotaryNFT(_notaryNFT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function verifyIdentity(address user, bytes calldata encryptedData) external returns (bool) {
        (bool success, ) = keeperContract.call(
            abi.encodeWithSignature("verifyIdentity(address,bytes)", user, encryptedData)
        );
        require(success, "AIValidationEngine: keeper call failed");
        bool result = true; // Placeholder — use AIEngine.sol for real validation
        emit IdentityVerified(user, result);
        return result;
    }

    function validateDocument(bytes32 documentHash, bytes calldata encryptedData) external returns (bool) {
        (bool success, ) = keeperContract.call(
            abi.encodeWithSignature("validateDocument(bytes32,bytes)", documentHash, encryptedData)
        );
        require(success, "AIValidationEngine: keeper call failed");
        bool result = true; // Placeholder — use AIEngine.sol for real validation
        emit DocumentValidated(documentHash, result);
        return result;
    }
}
