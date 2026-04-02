/**
 * ============================================================================
 * File:      api/services/oracle.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Oracle node service — submits AI validation requests to permissioned
 * on-chain oracle network and collects responses.
 *
 * Architecture (Phase 2):
 *   - Permissioned oracle nodes are registered in AIEngine.sol
 *   - This service signs oracle requests using ORACLE_PRIVATE_KEY
 *   - Responses are submitted on-chain via ethers.js
 *
 * Config:
 *   ORACLE_PRIVATE_KEY        — Private key of the oracle node wallet
 *   RPC_URL                   — Ethereum RPC URL
 *   AI_ENGINE_CONTRACT        — Deployed AIEngine.sol address
 *   VALIDATION_ORACLE_CONTRACT — Deployed ValidationOracle.sol address
 */

"use strict";

const { ethers } = require("ethers");

const RPC_URL           = process.env.RPC_URL || "http://localhost:8545";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const AI_ENGINE_CONTRACT  = process.env.AI_ENGINE_CONTRACT;

// Minimal ABI for AIEngine.sol request submission
const AI_ENGINE_ABI = [
  "function requestValidation(bytes32 documentHash, bytes32 metadataHash, uint8 category) external returns (uint256 requestId)",
  "function submitOracleResponse(uint256 requestId, bool isValid, uint256 confidence, uint256 fraudScore, bool identityVerified, bool documentAuthentic, bool signatureValid, bool tamperDetected) external",
  "event ValidationRequested(uint256 indexed requestId, bytes32 indexed documentHash)",
];

let provider = null;
let wallet   = null;
let aiEngine = null;

function _init() {
  if (!ORACLE_PRIVATE_KEY || !AI_ENGINE_CONTRACT) {
    console.warn("[Oracle] Oracle not configured — running in mock mode");
    return false;
  }
  if (provider) return true;

  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet   = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
  aiEngine = new ethers.Contract(AI_ENGINE_CONTRACT, AI_ENGINE_ABI, wallet);
  return true;
}

/**
 * Submit a validation request to the on-chain AIEngine oracle network.
 * @param {string} documentHash  0x-prefixed bytes32 document hash
 * @param {string} jurisdiction  ISO jurisdiction code (used to select category)
 * @returns {Promise<bigint|null>} On-chain requestId or null in mock mode
 */
async function submitRequest(documentHash, jurisdiction) {
  if (!_init()) {
    console.log(`[Oracle] Mock: would submit request for ${documentHash} (${jurisdiction})`);
    return null;
  }

  try {
    // DocumentCategory enum: 0=GENERAL, 1=DEED, 2=CONTRACT, 3=WILL, 4=PATENT
    const category = 0; // GENERAL — mapping from jurisdiction TBD
    const metadataHash = ethers.ZeroHash;

    const tx = await aiEngine.requestValidation(documentHash, metadataHash, category);
    const receipt = await tx.wait();

    // Parse requestId from event
    const event = receipt.logs
      .map(l => { try { return aiEngine.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "ValidationRequested");

    const requestId = event ? event.args.requestId : null;
    console.log(`[Oracle] Submitted on-chain request ${requestId} for ${documentHash}`);
    return requestId;
  } catch (err) {
    console.error("[Oracle] Failed to submit request:", err.message);
    return null;
  }
}

/**
 * Submit an oracle response to AIEngine.sol (called by oracle node after analysis).
 */
async function submitResponse(requestId, analysisResult) {
  if (!_init()) {
    console.log(`[Oracle] Mock: would submit response for request ${requestId}`);
    return;
  }

  try {
    const tx = await aiEngine.submitOracleResponse(
      requestId,
      analysisResult.riskScore < 50,        // isValid
      Math.round(analysisResult.confidence * 10000), // confidence (basis points)
      analysisResult.riskScore * 100,        // fraudScore (basis points, 0-10000)
      true,                                  // identityVerified
      true,                                  // documentAuthentic
      true,                                  // signatureValid
      analysisResult.fraudSignals.includes("document_tamper_detected")
    );
    await tx.wait();
    console.log(`[Oracle] Submitted response for request ${requestId}`);
  } catch (err) {
    console.error("[Oracle] Failed to submit response:", err.message);
  }
}

const oracleService = { submitRequest, submitResponse };
module.exports = { oracleService };
