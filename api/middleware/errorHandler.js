/**
 * ============================================================================
 * File:      api/middleware/errorHandler.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 * ============================================================================
 */
"use strict";

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (process.env.NODE_ENV !== "production") {
    console.error("[API Error]", err);
  }

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
