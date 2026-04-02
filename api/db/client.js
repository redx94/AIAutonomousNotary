/**
 * ============================================================================
 * File:      api/db/client.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * PostgreSQL connection pool via pg.
 * Set DATABASE_URL in .env:
 *   DATABASE_URL=postgres://user:pass@localhost:5432/ainotary
 */

"use strict";

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/ainotary",
  max:              20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err);
});

/**
 * Execute a parameterized query.
 * @param {string} text   SQL query
 * @param {Array}  params Query parameters
 */
async function dbQuery(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    if (process.env.LOG_QUERIES === "true") {
      console.log(`[DB] ${text.slice(0, 80)} — ${Date.now() - start}ms`);
    }
    return result;
  } catch (err) {
    console.error("[DB] Query error:", err.message, "\nQuery:", text);
    throw err;
  }
}

/**
 * Execute multiple queries in a single transaction.
 * @param {Function} fn  Async function receiving a query helper
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn((text, params) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, dbQuery, withTransaction };
