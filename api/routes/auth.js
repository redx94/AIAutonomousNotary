/**
 * ============================================================================
 * File:      api/routes/auth.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * EIP-191 wallet authentication routes.
 *
 *   GET  /api/auth/nonce/:address   → Returns challenge nonce for wallet to sign
 *   POST /api/auth/login            → Verify signature, issue JWT
 *   POST /api/auth/refresh          → Refresh JWT (must be valid and not expired)
 *   GET  /api/auth/me               → Returns current user profile
 */

"use strict";

const express = require("express");
const router  = express.Router();

const {
  generateNonce,
  consumeNonce,
  verifySignature,
  issueToken,
  authMiddleware,
} = require("../middleware/auth");

// GET /api/auth/nonce/:address
router.get("/nonce/:address", (req, res) => {
  const { address } = req.params;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }
  const nonce = generateNonce(address);
  res.json({ address, nonce });
});

// POST /api/auth/login
// Body: { address, signature }
router.post("/login", (req, res) => {
  const { address, signature } = req.body;

  if (!address || !signature) {
    return res.status(400).json({ error: "address and signature required" });
  }

  const nonce = consumeNonce(address);
  if (!nonce) {
    return res.status(401).json({ error: "Nonce expired or not found. Request a new nonce." });
  }

  const valid = verifySignature(nonce, signature, address);
  if (!valid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Determine role — in production, look up on-chain roles via ethers.js
  // For now, default to "user"
  const role  = "user";
  const token = issueToken(address, role);

  res.json({ token, address: address.toLowerCase(), role });
});

// POST /api/auth/refresh
router.post("/refresh", authMiddleware, (req, res) => {
  const { address, role } = req.user;
  const token = issueToken(address, role);
  res.json({ token, address, role });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  res.json({ address: req.user.address, role: req.user.role });
});

module.exports = router;
