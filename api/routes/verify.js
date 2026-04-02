/**
 * ============================================================================
 * File:      api/routes/verify.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Public certificate verification — no auth required.
 *
 *   GET  /api/verify/:tokenId          Full verification record
 *   GET  /api/verify/:tokenId/summary  Lightweight summary (for embeds)
 */

"use strict";

const express = require("express");
const router  = express.Router();
const { dbQuery } = require("../db/client");

// GET /api/verify/:tokenId
router.get("/:tokenId", async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const result = await dbQuery(
      `SELECT n.token_id, n.document_hash, n.seal_status, n.notary_address,
              n.minted_at, n.expiry_date, n.jurisdiction, n.doc_type,
              n.ai_validated, n.confidence_score, n.ipfs_cid,
              d.title, d.owner_address, d.created_at AS registered_at
       FROM notary_seals n
       LEFT JOIN documents d ON d.token_id = n.token_id
       WHERE n.token_id = $1`,
      [tokenId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    const seal = result.rows[0];

    // Determine validity
    const isActive  = seal.seal_status === "ACTIVE";
    const isExpired = seal.expiry_date && new Date(seal.expiry_date) < new Date();

    res.json({
      tokenId:          seal.token_id,
      documentHash:     seal.document_hash,
      status:           isExpired ? "EXPIRED" : seal.seal_status,
      valid:            isActive && !isExpired,
      notaryAddress:    seal.notary_address,
      mintedAt:         seal.minted_at,
      expiryDate:       seal.expiry_date,
      jurisdiction:     seal.jurisdiction,
      documentType:     seal.doc_type,
      aiValidated:      seal.ai_validated,
      confidenceScore:  seal.confidence_score,
      ipfsCid:          seal.ipfs_cid,
      title:            seal.title,
      ownerAddress:     seal.owner_address,
      registeredAt:     seal.registered_at,
      verificationUrl:  `${process.env.FRONTEND_URL || "https://app.ainotary.io"}/verify/${tokenId}`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/verify/:tokenId/summary
router.get("/:tokenId/summary", async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const result = await dbQuery(
      `SELECT token_id, seal_status, notary_address, minted_at, expiry_date, jurisdiction
       FROM notary_seals WHERE token_id = $1`,
      [tokenId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const s = result.rows[0];
    const isExpired = s.expiry_date && new Date(s.expiry_date) < new Date();
    res.json({
      tokenId:      s.token_id,
      valid:        s.seal_status === "ACTIVE" && !isExpired,
      status:       isExpired ? "EXPIRED" : s.seal_status,
      jurisdiction: s.jurisdiction,
      mintedAt:     s.minted_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
