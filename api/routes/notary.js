/**
 * ============================================================================
 * File:      api/routes/notary.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 *   GET  /api/notary/dashboard         Pending notarization queue
 *   GET  /api/notary/sessions/:id      Multi-party signing session details
 *   POST /api/notary/sessions/:id/sign Record EIP-712 signature submission
 *   GET  /api/notary/earnings          Notary fee tracking
 *   GET  /api/notary/credentials       DID / credential status
 */

"use strict";

const express = require("express");
const router  = express.Router();
const { dbQuery }    = require("../db/client");
const { requireRole } = require("../middleware/auth");

// GET /api/notary/dashboard
router.get("/dashboard", requireRole("notary", "admin"), async (req, res, next) => {
  try {
    const { status = "PENDING", limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await dbQuery(
      `SELECT mr.*, d.title, d.document_hash, d.ipfs_cid, d.jurisdiction,
              d.document_type, d.owner_address
       FROM mint_requests mr
       JOIN documents d ON d.id = mr.document_id
       WHERE mr.notary_address = $1 AND mr.status = $2
       ORDER BY mr.created_at ASC
       LIMIT $3 OFFSET $4`,
      [req.user.address, status.toUpperCase(), limit, offset]
    );

    res.json({ queue: result.rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/notary/sessions/:id
router.get("/sessions/:id", requireRole("notary", "admin"), async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT s.*, d.document_hash, d.title, d.ipfs_cid,
              json_agg(sg.*) AS signatories
       FROM signing_sessions s
       JOIN documents d ON d.id = s.document_id
       LEFT JOIN signatories sg ON sg.session_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, d.document_hash, d.title, d.ipfs_cid`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/notary/sessions/:id/sign
// Body: { signature, signatureHash }
router.post("/sessions/:id/sign", requireRole("notary", "admin"), async (req, res, next) => {
  try {
    const { signature, signatureHash } = req.body;
    if (!signature || !signatureHash) {
      return res.status(400).json({ error: "signature and signatureHash required" });
    }

    const session = await dbQuery(
      `SELECT * FROM signing_sessions WHERE id = $1`, [req.params.id]
    );
    if (session.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    await dbQuery(
      `INSERT INTO signatories (session_id, signer_address, signature, signature_hash, signed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (session_id, signer_address) DO UPDATE
         SET signature = $3, signature_hash = $4, signed_at = NOW()`,
      [req.params.id, req.user.address, signature, signatureHash]
    );

    // Update collected signatures count
    await dbQuery(
      `UPDATE signing_sessions SET collected_signatures = collected_signatures + 1, updated_at = NOW()
       WHERE id = $1`, [req.params.id]
    );

    res.json({ message: "Signature recorded", sessionId: req.params.id });
  } catch (err) {
    next(err);
  }
});

// GET /api/notary/earnings
router.get("/earnings", requireRole("notary", "admin"), async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT DATE_TRUNC('month', earned_at) AS month,
              SUM(amount_wei) AS total_wei,
              COUNT(*) AS transaction_count
       FROM notary_earnings
       WHERE notary_address = $1
       GROUP BY month ORDER BY month DESC LIMIT 12`,
      [req.user.address]
    );
    res.json({ earnings: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/notary/credentials
router.get("/credentials", requireRole("notary", "admin"), async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM did_credentials WHERE holder_address = $1 ORDER BY issued_at DESC`,
      [req.user.address]
    );
    res.json({ credentials: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
