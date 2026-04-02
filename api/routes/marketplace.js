/**
 * ============================================================================
 * File:      api/routes/marketplace.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 *   GET  /api/marketplace                  List all vaults/share tokens
 *   GET  /api/marketplace/:vault           Get vault detail
 *   GET  /api/marketplace/:vault/orders    Order book
 *   POST /api/marketplace/:vault/buy       Record market buy intent
 *   GET  /api/marketplace/auctions         List active auctions
 *   GET  /api/marketplace/auctions/:id     Auction detail
 */

"use strict";

const express = require("express");
const router  = express.Router();
const { dbQuery } = require("../db/client");

// GET /api/marketplace
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sort = "created_at", order = "DESC" } = req.query;
    const safeSort  = ["created_at", "floor_price", "total_shares"].includes(sort) ? sort : "created_at";
    const safeOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";
    const offset = (page - 1) * limit;

    const result = await dbQuery(
      `SELECT v.*, d.title, d.jurisdiction, d.document_type, n.seal_status
       FROM vaults v
       LEFT JOIN documents d ON d.token_id = v.nft_token_id
       LEFT JOIN notary_seals n ON n.token_id = v.nft_token_id
       WHERE v.state = 'OPEN'
       ORDER BY v.${safeSort} ${safeOrder}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ vaults: result.rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/marketplace/:vault
router.get("/:vault", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT v.*, d.title, d.jurisdiction, d.document_type, d.ipfs_cid
       FROM vaults v
       LEFT JOIN documents d ON d.token_id = v.nft_token_id
       WHERE v.vault_address = $1 OR v.id = $1::integer`,
      [req.params.vault]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vault not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/marketplace/:vault/orders
router.get("/:vault/orders", async (req, res, next) => {
  try {
    const { side } = req.query; // "ask" | "bid"
    let query = `SELECT * FROM marketplace_orders WHERE vault_address = $1 AND status = 'OPEN'`;
    const params = [req.params.vault];
    if (side) {
      query += ` AND side = $2`;
      params.push(side.toUpperCase());
    }
    query += ` ORDER BY price_per_share ${side === "bid" ? "DESC" : "ASC"} LIMIT 100`;
    const result = await dbQuery(query, params);
    res.json({ orders: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/marketplace/:vault/buy
// Records off-chain intent; actual tx constructed by frontend via wagmi
router.post("/:vault/buy", async (req, res, next) => {
  try {
    const { amount, maxPrice } = req.body;
    if (!amount || !maxPrice) {
      return res.status(400).json({ error: "amount and maxPrice required" });
    }

    await dbQuery(
      `INSERT INTO purchase_intents (vault_address, buyer_address, amount, max_price, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())`,
      [req.params.vault, req.user.address, amount, maxPrice]
    );

    res.json({ message: "Purchase intent recorded. Execute transaction via connected wallet." });
  } catch (err) {
    next(err);
  }
});

// GET /api/marketplace/auctions
router.get("/auctions", async (req, res, next) => {
  try {
    const { type } = req.query; // "dutch" | "english"
    let query = `SELECT * FROM auctions WHERE status = 'OPEN'`;
    const params = [];
    if (type) {
      query += ` AND auction_type = $1`;
      params.push(type.toUpperCase());
    }
    query += ` ORDER BY end_time ASC LIMIT 50`;
    const result = await dbQuery(query, params);
    res.json({ auctions: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/marketplace/auctions/:id
router.get("/auctions/:id", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM auctions WHERE id = $1 OR auction_id = $1::integer`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Auction not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
