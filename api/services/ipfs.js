/**
 * ============================================================================
 * File:      api/services/ipfs.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * IPFS/Pinata service wrapper.
 * Handles document pinning and retrieval for on-chain DocumentRegistry CID fields.
 *
 * Config (environment variables):
 *   PINATA_JWT       — Pinata JWT API key (preferred)
 *   PINATA_API_KEY   — Legacy API key
 *   PINATA_SECRET    — Legacy API secret
 *   IPFS_GATEWAY     — Custom gateway URL (default: https://gateway.pinata.cloud)
 */

"use strict";

const https   = require("https");
const http    = require("http");
const FormData = require("form-data");

const PINATA_JWT    = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET  = process.env.PINATA_SECRET;
const IPFS_GATEWAY   = process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud";

const PINATA_PIN_URL  = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_UNPIN_URL = (cid) => `https://api.pinata.cloud/pinning/unpin/${cid}`;

function pinataHeaders() {
  if (PINATA_JWT) {
    return { Authorization: `Bearer ${PINATA_JWT}` };
  }
  return {
    pinata_api_key:    PINATA_API_KEY,
    pinata_secret_api_key: PINATA_SECRET,
  };
}

/**
 * Pin a file buffer to IPFS via Pinata.
 * @param {Buffer} buffer     File contents
 * @param {string} filename   Original filename
 * @param {Object} metadata   Optional Pinata metadata (name, keyvalues)
 * @returns {Promise<string>} IPFS CID
 */
async function pin(buffer, filename, metadata = {}) {
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET)) {
    console.warn("[IPFS] Pinata credentials not configured — using mock CID");
    return `Qm${Buffer.from(filename + Date.now()).toString("base64").slice(0, 44)}`;
  }

  const form = new FormData();
  form.append("file", buffer, { filename });

  if (metadata.name || metadata.keyvalues) {
    form.append("pinataMetadata", JSON.stringify({
      name:      metadata.name || filename,
      keyvalues: metadata.keyvalues || {},
    }));
  }

  const response = await _post(PINATA_PIN_URL, form, {
    ...pinataHeaders(),
    ...form.getHeaders(),
  });

  return response.IpfsHash;
}

/**
 * Pin a JSON object to IPFS via Pinata.
 * @param {Object} obj      JSON-serializable object
 * @param {string} name     Pin name
 * @returns {Promise<string>} IPFS CID
 */
async function pinJSON(obj, name = "metadata") {
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET)) {
    console.warn("[IPFS] Pinata credentials not configured — using mock CID");
    return `Qm${Buffer.from(JSON.stringify(obj)).toString("base64").slice(0, 44)}`;
  }

  const body = JSON.stringify({
    pinataContent: obj,
    pinataMetadata: { name },
  });

  const response = await _post(PINATA_JSON_URL, body, {
    ...pinataHeaders(),
    "Content-Type": "application/json",
  });

  return response.IpfsHash;
}

/**
 * Unpin a CID from Pinata (GDPR erasure flow).
 * @param {string} cid  IPFS CID to unpin
 */
async function unpin(cid) {
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET)) {
    console.warn("[IPFS] Pinata credentials not configured — skipping unpin");
    return;
  }

  await _delete(PINATA_UNPIN_URL(cid), pinataHeaders());
}

/**
 * Get the HTTP URL for an IPFS CID via configured gateway.
 * @param {string} cid
 * @returns {string}
 */
function gatewayUrl(cid) {
  return `${IPFS_GATEWAY}/ipfs/${cid}`;
}

// ─── Internal HTTP helpers ────────────────────────────────────────────────────

function _post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body) || (body && body.pipe);
    const data     = isBuffer || typeof body === "object" && body.getBuffer
      ? body
      : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));

    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path:     opts.pathname,
      method:   "POST",
      headers:  { ...headers, ...(typeof data.getLengthSync === "function"
        ? { "Content-Length": data.getLengthSync() } : {}) },
    }, (res) => {
      let raw = "";
      res.on("data", d => { raw += d; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        } else {
          reject(new Error(`Pinata error ${res.statusCode}: ${raw}`));
        }
      });
    });
    req.on("error", reject);
    if (data && data.pipe) {
      data.pipe(req);
    } else {
      req.end(data);
    }
  });
}

function _delete(url, headers) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path:     opts.pathname,
      method:   "DELETE",
      headers,
    }, (res) => {
      res.resume();
      if (res.statusCode >= 200 && res.statusCode < 300) resolve();
      else reject(new Error(`Pinata unpin error ${res.statusCode}`));
    });
    req.on("error", reject);
    req.end();
  });
}

const ipfsService = { pin, pinJSON, unpin, gatewayUrl };
module.exports = { ipfsService };
