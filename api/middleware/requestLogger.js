/**
 * ============================================================================
 * File:      api/middleware/requestLogger.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 * ============================================================================
 */
"use strict";

function requestLogger(req, _res, next) {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[API] ${req.method} ${req.path} ${req.user?.address || req.ip}`);
  }
  next();
}

module.exports = { requestLogger };
