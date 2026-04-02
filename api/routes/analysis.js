/**
 * ============================================================================
 * File:      api/routes/analysis.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 *   POST /api/analysis/submit          Submit document for AI analysis
 *   GET  /api/analysis/:id             Get analysis results
 *   GET  /api/analysis/:id/nlp         NLP-specific results (clauses, parties)
 *   GET  /api/analysis/:id/fraud       Fraud score and signals
 */

"use strict";

const express = require("express");
const router  = express.Router();
const { dbQuery }       = require("../db/client");
const { aiService }     = require("../services/ai");
const { oracleService } = require("../services/oracle");

// POST /api/analysis/submit
router.post("/submit", async (req, res, next) => {
  try {
    const { documentId, jurisdiction = "US", language = "ENGLISH" } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId required" });
    }

    // Verify caller owns the document
    const doc = await dbQuery(
      `SELECT * FROM documents WHERE (id = $1 OR token_id = $1::text::integer) AND owner_address = $2 LIMIT 1`,
      [documentId, req.user.address]
    );
    if (doc.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Create analysis record
    const analysis = await dbQuery(
      `INSERT INTO ai_analyses (document_id, requester_address, jurisdiction, language, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())
       RETURNING id`,
      [doc.rows[0].id, req.user.address, jurisdiction, language]
    );
    const analysisId = analysis.rows[0].id;

    // Kick off async AI analysis (hybrid: third-party API seam)
    aiService.analyzeAsync(analysisId, doc.rows[0]).catch(err =>
      console.error(`[Analysis] Failed for ${analysisId}:`, err)
    );

    // Submit to oracle network for on-chain anchoring
    oracleService.submitRequest(doc.rows[0].document_hash, jurisdiction).catch(err =>
      console.error(`[Oracle] Failed to submit for ${analysisId}:`, err)
    );

    res.status(202).json({
      analysisId,
      status: "PENDING",
      message: "Analysis submitted. Results available shortly at GET /api/analysis/:id",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analysis/:id
router.get("/:id", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT a.*, d.document_hash, d.title, d.jurisdiction
       FROM ai_analyses a
       JOIN documents d ON d.id = a.document_id
       WHERE a.id = $1 AND (a.requester_address = $2 OR d.owner_address = $2)`,
      [req.params.id, req.user.address]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Analysis not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/analysis/:id/nlp
router.get("/:id/nlp", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT n.* FROM nlp_results n
       JOIN ai_analyses a ON a.id = n.analysis_id
       JOIN documents d ON d.id = a.document_id
       WHERE n.analysis_id = $1 AND (a.requester_address = $2 OR d.owner_address = $2)`,
      [req.params.id, req.user.address]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "NLP results not yet available" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/analysis/:id/fraud
router.get("/:id/fraud", async (req, res, next) => {
  try {
    const result = await dbQuery(
      `SELECT f.* FROM fraud_signals f
       JOIN ai_analyses a ON a.document_id = f.document_id
       WHERE a.id = $1 AND (a.requester_address = $2)`,
      [req.params.id, req.user.address]
    );
    res.json({ signals: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
