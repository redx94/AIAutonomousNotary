/**
 * ============================================================================
 * File:      api/services/ai.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * AI analysis service — hybrid provider seam.
 *
 * Near term: Routes to third-party APIs (OpenAI GPT-4o, AWS Rekognition,
 *            custom ML endpoints) based on AI_PROVIDER env var.
 * Mid/long term: Proprietary models for fraud scoring, NLP, document intelligence.
 *
 * Config:
 *   AI_PROVIDER     = "openai" | "aws" | "mock" (default: "mock")
 *   OPENAI_API_KEY  = OpenAI API key
 *   AWS_REGION      = AWS region for Rekognition
 */

"use strict";

const { dbQuery } = require("../db/client");

const AI_PROVIDER = process.env.AI_PROVIDER || "mock";

// ─────────────────────────────────────────────────────────────────────────────
// Provider implementations
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeWithMock(document) {
  // Mirrors current overlay/ron/AIAnalysisService.js behavior
  await new Promise(r => setTimeout(r, 200)); // Simulate async work
  return {
    riskScore:         25,
    recommendation:    "approve_with_human_review",
    confidence:        0.88,
    fraudSignals:      [],
    documentFindings:  [{ type: "document_integrity", result: "no_material_anomalies_detected" }],
    identityFindings:  [{ type: "identity_consistency", result: "consistent" }],
    provider:          "mock",
  };
}

async function analyzeWithOpenAI(document) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  // Construct prompt for document analysis
  const prompt = `You are a legal document analysis AI for a notary protocol.
Analyze the following document metadata and provide a structured risk assessment.

Document Hash: ${document.document_hash}
Document Type: ${document.document_type}
Jurisdiction: ${document.jurisdiction}
Title: ${document.title}

Respond with JSON: { riskScore (0-100), recommendation, confidence (0-1), fraudSignals [], documentFindings [] }`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:    "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}`);
  }

  const data  = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    riskScore:        parsed.riskScore || 25,
    recommendation:   parsed.recommendation || "approve_with_human_review",
    confidence:       parsed.confidence || 0.8,
    fraudSignals:     parsed.fraudSignals || [],
    documentFindings: parsed.documentFindings || [],
    identityFindings: [],
    provider:         "openai",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run AI analysis asynchronously and update the DB record.
 * @param {number} analysisId  DB ID of the ai_analyses record
 * @param {Object} document    Document row from DB
 */
async function analyzeAsync(analysisId, document) {
  try {
    await dbQuery(
      `UPDATE ai_analyses SET status = 'IN_PROGRESS' WHERE id = $1`,
      [analysisId]
    );

    let result;
    switch (AI_PROVIDER) {
      case "openai": result = await analyzeWithOpenAI(document); break;
      default:       result = await analyzeWithMock(document);   break;
    }

    await dbQuery(
      `UPDATE ai_analyses SET
         status = 'COMPLETE',
         risk_score = $1,
         recommendation = $2,
         confidence = $3,
         fraud_signals = $4,
         document_findings = $5,
         identity_findings = $6,
         provider = $7,
         completed_at = NOW()
       WHERE id = $8`,
      [
        result.riskScore,
        result.recommendation,
        result.confidence,
        JSON.stringify(result.fraudSignals),
        JSON.stringify(result.documentFindings),
        JSON.stringify(result.identityFindings),
        result.provider,
        analysisId,
      ]
    );
  } catch (err) {
    console.error(`[AI] Analysis ${analysisId} failed:`, err.message);
    await dbQuery(
      `UPDATE ai_analyses SET status = 'FAILED', completed_at = NOW() WHERE id = $1`,
      [analysisId]
    );
  }
}

const aiService = { analyzeAsync };
module.exports  = { aiService };
