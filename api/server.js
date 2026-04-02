/**
 * ============================================================================
 * File:      api/server.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * REST API server for the AI Autonomous Notary Protocol.
 * Provides endpoints consumed by the Next.js frontend.
 *
 * Auth: EIP-191 wallet-signed JWT (no username/password).
 * Rate limiting: 100 req/min general, 10 req/min upload endpoints.
 */

"use strict";

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");

const { authMiddleware }      = require("./middleware/auth");
const { rateLimiter, strictRateLimiter } = require("./middleware/rateLimit");
const { errorHandler }        = require("./middleware/errorHandler");
const { requestLogger }       = require("./middleware/requestLogger");

const authRoutes       = require("./routes/auth");
const documentsRoutes  = require("./routes/documents");
const marketplaceRoutes = require("./routes/marketplace");
const portfolioRoutes  = require("./routes/portfolio");
const analysisRoutes   = require("./routes/analysis");
const policiesRoutes   = require("./routes/policies");
const verifyRoutes     = require("./routes/verify");
const notaryRoutes     = require("./routes/notary");
const adminRoutes      = require("./routes/admin");

const app  = express();
const PORT = process.env.API_PORT || 4000;

// ─── Security & Parsing ──────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────────────────

app.use(requestLogger);

// ─── Rate Limiting ───────────────────────────────────────────────────────────

app.use("/api/", rateLimiter);

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
});

// ─── Public Routes (no auth) ─────────────────────────────────────────────────

app.use("/api/auth",    authRoutes);
app.use("/api/verify",  verifyRoutes);   // /api/verify/:tokenId — public cert check
app.use("/api/policies", policiesRoutes); // GET policies are public

// ─── Protected Routes ────────────────────────────────────────────────────────

app.use("/api/documents",   authMiddleware, strictRateLimiter, documentsRoutes);
app.use("/api/marketplace", authMiddleware, marketplaceRoutes);
app.use("/api/portfolio",   authMiddleware, portfolioRoutes);
app.use("/api/analysis",    authMiddleware, strictRateLimiter, analysisRoutes);
app.use("/api/notary",      authMiddleware, notaryRoutes);
app.use("/api/admin",       authMiddleware, adminRoutes);

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[API] AI Autonomous Notary API listening on port ${PORT}`);
  });
}

module.exports = app;
