/**
 * ============================================================================
 * File:      api/routes/documents.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Document management routes (all require auth):
 *
 *   POST /api/documents/upload        Upload document → IPFS → return CID + hash
 *   GET  /api/documents               List caller's documents
 *   GET  /api/documents/:tokenId      Get document detail
 *   POST /api/documents/:tokenId/mint-nft  Mint NotaryNFT for document
 *   GET  /api/documents/:tokenId/status    Get current document status
 */

"use strict";

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const { ipfsService }   = require("../services/ipfs");
const { hashDocument }  = require("../services/hash");
const { dbQuery }       = require("../db/client");

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "application/msword",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// POST /api/documents/upload
router.post("/upload", upload.single("document"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded or unsupported format" });
    }

    const { jurisdiction = "US", documentType = "OTHER", title = "" } = req.body;
    const documentHash = hashDocument(req.file.buffer);
    const ipfsCid      = await ipfsService.pin(req.file.buffer, req.file.originalname);

    // Persist to DB
    const result = await dbQuery(
      `INSERT INTO documents (owner_address, document_hash, ipfs_cid, title, jurisdiction, document_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())
       RETURNING id, document_hash, ipfs_cid, created_at`,
      [req.user.address, documentHash, ipfsCid, title, jurisdiction, documentType]
    );

    res.status(201).json({
      documentId:   result.rows[0].id,
      documentHash: result.rows[0].document_hash,
      ipfsCid:      result.rows[0].ipfs_cid,
      uploadedAt:   result.rows[0].created_at,
      message:      "Document uploaded and pinned to IPFS",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT id, document_hash, ipfs_cid, title, jurisdiction, document_type,
                        status, token_id, created_at, updated_at
                 FROM documents WHERE owner_address = $1`;
    const params = [req.user.address];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status.toUpperCase());
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await dbQuery(query, params);
    res.json({ documents: result.rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:tokenId
router.get("/:tokenId", async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const result = await dbQuery(
      `SELECT d.*, a.risk_score, a.recommendation, a.confidence
       FROM documents d
       LEFT JOIN ai_analyses a ON a.document_id = d.id
       WHERE (d.token_id = $1 OR d.id = $1::integer)
         AND d.owner_address = $2
       LIMIT 1`,
      [tokenId, req.user.address]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:tokenId/mint-nft
// Initiates on-chain minting (frontend handles tx; this logs intent)
router.post("/:tokenId/mint-nft", async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const { notaryAddress, expiryDate } = req.body;

    const doc = await dbQuery(
      `SELECT * FROM documents WHERE (token_id = $1 OR id = $1::integer) AND owner_address = $2 LIMIT 1`,
      [tokenId, req.user.address]
    );
    if (doc.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    await dbQuery(
      `INSERT INTO mint_requests (document_id, requester_address, notary_address, expiry_date, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())
       ON CONFLICT (document_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
      [doc.rows[0].id, req.user.address, notaryAddress, expiryDate]
    );

    res.json({
      message: "Mint request recorded. Complete the on-chain transaction via the frontend.",
      documentHash: doc.rows[0].document_hash,
      ipfsCid:      doc.rows[0].ipfs_cid,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:tokenId/status
router.get("/:tokenId/status", async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const result = await dbQuery(
      `SELECT status, token_id, updated_at FROM documents
       WHERE (token_id = $1 OR id = $1::integer) AND owner_address = $2 LIMIT 1`,
      [tokenId, req.user.address]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
