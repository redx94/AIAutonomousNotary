/**
 * ============================================================================
 * File:      api/services/hash.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 */

"use strict";

const crypto = require("crypto");

/**
 * Compute SHA-256 hash of a document buffer.
 * Returns a 0x-prefixed hex string matching Solidity bytes32 convention.
 * @param {Buffer} buffer
 * @returns {string}
 */
function hashDocument(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Compute keccak256 hash of a string or buffer.
 * @param {string|Buffer} data
 * @returns {string} 0x-prefixed hex
 */
function keccak256(data) {
  const { ethers } = require("ethers");
  return typeof data === "string"
    ? ethers.keccak256(ethers.toUtf8Bytes(data))
    : ethers.keccak256(data);
}

module.exports = { hashDocument, keccak256 };
