/**
 * ============================================================================
 * File:      api/routes/admin.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Admin-only routes:
 *   GET  /api/admin/stats              Protocol-wide stats
 *   GET  /api/admin/oracle/nodes       Registered oracle nodes
 *   POST /api/admin/oracle/submit      Manually submit oracle response
 *   GET  /api/admin/policies           All policies (including inactive)
 *   POST /api/admin/emergency/pause    Emergency pause a contract
 */

"use strict";

const express = require("express");
const router  = express.Router();
const { dbQuery }     = require("../db/client");
const { requireRole } = require("../middleware/auth");

// All admin routes require admin role
router.use(requireRole("admin"));

// GET /api/admin/stats
router.get("/stats", async (req, res, next) => {
  try {
    const [documents, analyses, nfts, vaults] = await Promise.all([
      dbQuery("SELECT COUNT(*) FROM documents"),
      dbQuery("SELECT COUNT(*) FROM ai_analyses WHERE status = 'COMPLETE'"),
      dbQuery("SELECT COUNT(*) FROM notary_seals WHERE seal_status = 'ACTIVE'"),
      dbQuery("SELECT COUNT(*) FROM vaults WHERE state = 'OPEN'"),
    ]);

    res.json({
      totalDocuments:  parseInt(documents.rows[0].count),
      completedAnalyses: parseInt(analyses.rows[0].count),
      activeNFTs:      parseInt(nfts.rows[0].count),
      openVaults:      parseInt(vaults.rows[0].count),
      timestamp:       new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/oracle/nodes
router.get("/oracle/nodes", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT address, reputation_score, total_responses, last_active_at, active
       FROM oracle_nodes ORDER BY reputation_score DESC`
    );
    res.json({ nodes: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/oracle/submit
// Body: { requestId, isValid, confidence, fraudScore }
router.post("/oracle/submit", async (req, res, next) => {
  try {
    const { requestId, isValid, confidence, fraudScore } = req.body;
    if (requestId == null || isValid == null) {
      return res.status(400).json({ error: "requestId and isValid required" });
    }

    await dbQuery(
      `INSERT INTO oracle_responses (request_id, oracle_address, is_valid, confidence, fraud_score, submitted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [requestId, req.user.address, isValid, confidence, fraudScore]
    );

    res.json({ message: "Oracle response recorded" });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/policies
router.get("/policies", (_req, res) => {
  const path = require("path");
  const fs   = require("fs");
  try {
    const rules = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../overlay/policy/data/defaultRules.json"), "utf-8")
    );
    res.json(rules);
  } catch {
    res.status(500).json({ error: "Failed to load policies" });
  }
});

module.exports = router;
