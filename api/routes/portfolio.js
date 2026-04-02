/**
 * ============================================================================
 * File:      api/routes/portfolio.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 *   GET  /api/portfolio               User's fractional share holdings
 *   GET  /api/portfolio/yield         Unclaimed yield per vault
 *   POST /api/portfolio/yield/claim   Record yield claim intent
 *   GET  /api/portfolio/nfts          User's NotaryNFTs
 *   GET  /api/portfolio/loans         User's active lending positions
 */

"use strict";

const express = require("express");
const router  = express.Router();
const { dbQuery } = require("../db/client");

// GET /api/portfolio
router.get("/", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT h.*, v.vault_address, v.nft_token_id, v.floor_price, v.state,
              d.title, d.jurisdiction
       FROM share_holdings h
       JOIN vaults v ON v.vault_address = h.vault_address
       LEFT JOIN documents d ON d.token_id = v.nft_token_id
       WHERE h.holder_address = $1 AND h.balance > 0
       ORDER BY h.updated_at DESC`,
      [req.user.address]
    );
    res.json({ holdings: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/portfolio/yield
router.get("/yield", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT h.vault_address, h.balance, h.holder_index,
              v.distribution_index, v.total_distributed,
              ((h.balance * (v.distribution_index - h.holder_index)) / 1e18)::numeric AS pending_yield_wei
       FROM share_holdings h
       JOIN vaults v ON v.vault_address = h.vault_address
       WHERE h.holder_address = $1 AND h.balance > 0`,
      [req.user.address]
    );
    res.json({ yields: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/portfolio/yield/claim
router.post("/yield/claim", async (req, res, next) => {
  try {
    const { vaultAddress } = req.body;
    if (!vaultAddress) {
      return res.status(400).json({ error: "vaultAddress required" });
    }
    await dbQuery(
      `INSERT INTO yield_claim_intents (vault_address, claimer_address, status, created_at)
       VALUES ($1, $2, 'PENDING', NOW())`,
      [vaultAddress, req.user.address]
    );
    res.json({ message: "Yield claim intent recorded. Execute transaction via connected wallet." });
  } catch (err) {
    next(err);
  }
});

// GET /api/portfolio/nfts
router.get("/nfts", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT n.*, d.title, d.document_type, d.jurisdiction, d.ipfs_cid
       FROM notary_seals n
       LEFT JOIN documents d ON d.token_id = n.token_id
       WHERE n.owner_address = $1
       ORDER BY n.minted_at DESC`,
      [req.user.address]
    );
    res.json({ nfts: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/portfolio/loans
router.get("/loans", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM lending_positions
       WHERE borrower_address = $1 AND active = TRUE
       ORDER BY created_at DESC`,
      [req.user.address]
    );
    res.json({ positions: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
