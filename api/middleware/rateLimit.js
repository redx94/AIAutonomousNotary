/**
 * ============================================================================
 * File:      api/middleware/rateLimit.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 */

"use strict";

// In-memory rate limiter — replace with Redis-backed in production
// (e.g. express-rate-limit + rate-limit-redis)

const requestCounts = new Map(); // key → { count, windowStart }

/**
 * Create a rate limiter middleware.
 * @param {number} maxRequests Max requests per window
 * @param {number} windowMs    Window duration in milliseconds
 */
function createRateLimiter(maxRequests, windowMs) {
  return (req, res, next) => {
    const key = req.user?.address || req.ip;
    const now  = Date.now();
    const entry = requestCounts.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      requestCounts.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.set("Retry-After", retryAfter);
      return res.status(429).json({
        error: "Too many requests",
        retryAfter,
      });
    }

    entry.count++;
    next();
  };
}

const rateLimiter       = createRateLimiter(100, 60 * 1000); // 100 req/min
const strictRateLimiter = createRateLimiter(10,  60 * 1000); // 10 req/min (upload/analysis)

module.exports = { rateLimiter, strictRateLimiter, createRateLimiter };
