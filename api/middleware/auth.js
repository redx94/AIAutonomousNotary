/**
 * ============================================================================
 * File:      api/middleware/auth.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * EIP-191 wallet-signature JWT authentication middleware.
 *
 * Flow:
 *   1. Client signs a nonce with their wallet (EIP-191 personal_sign)
 *   2. POST /api/auth/login with { address, signature, nonce }
 *   3. Server verifies signature, issues JWT containing { address, role }
 *   4. Client includes JWT in Authorization: Bearer <token> header
 *   5. authMiddleware verifies JWT on protected routes
 */

"use strict";

const jwt     = require("jsonwebtoken");
const { ethers } = require("ethers");

const JWT_SECRET  = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY  = process.env.JWT_EXPIRY  || "24h";
const NONCE_TTL   = 5 * 60 * 1000; // 5 minutes in ms

// In-memory nonce store — replace with Redis in production
const nonceStore = new Map(); // address → { nonce, createdAt }

// ─── Nonce Management ────────────────────────────────────────────────────────

/**
 * Generate and store a one-time nonce for wallet signature challenge.
 */
function generateNonce(address) {
  const nonce = `Sign this message to authenticate with AI Autonomous Notary.\n\nNonce: ${
    Math.random().toString(36).substring(2)
  }\nTimestamp: ${Date.now()}`;
  nonceStore.set(address.toLowerCase(), { nonce, createdAt: Date.now() });
  return nonce;
}

/**
 * Consume and validate a nonce (single-use).
 */
function consumeNonce(address) {
  const entry = nonceStore.get(address.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.createdAt > NONCE_TTL) {
    nonceStore.delete(address.toLowerCase());
    return null;
  }
  nonceStore.delete(address.toLowerCase());
  return entry.nonce;
}

// ─── Signature Verification ──────────────────────────────────────────────────

/**
 * Verify an EIP-191 personal_sign signature.
 * @param {string} message  The signed message (the nonce)
 * @param {string} signature Hex signature from wallet
 * @param {string} address  Claimed signer address
 * @returns {boolean}
 */
function verifySignature(message, signature, address) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

function issueToken(address, role = "user") {
  return jwt.sign({ address: address.toLowerCase(), role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Protect a route — requires valid JWT.
 * Sets req.user = { address, role }
 */
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing token" });
  }
  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: invalid token" });
  }
}

/**
 * Require a specific role.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = {
  generateNonce,
  consumeNonce,
  verifySignature,
  issueToken,
  verifyToken,
  authMiddleware,
  requireRole,
};
