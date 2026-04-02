/**
 * ============================================================================
 * File:      api/routes/policies.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 *   GET  /api/policies/:jurisdiction   Get active policy rules for jurisdiction
 *   POST /api/policies/validate        Validate an act context against policy
 *   GET  /api/policies                 List all supported jurisdictions
 */

"use strict";

const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");

const { dbQuery } = require("../db/client");

// Load local policy data (overlay/policy/data/)
const RULES_PATH = path.resolve(__dirname, "../../overlay/policy/data/defaultRules.json");
const US_STATE_RULES_PATH = path.resolve(__dirname, "../../overlay/policy/data/us-state-rules.json");

function loadLocalRules() {
  try {
    const rules = JSON.parse(fs.readFileSync(RULES_PATH, "utf-8")).rules;
    const stateRules = fs.existsSync(US_STATE_RULES_PATH)
      ? JSON.parse(fs.readFileSync(US_STATE_RULES_PATH, "utf-8")).rules
      : [];
    return [...rules, ...stateRules];
  } catch {
    return [];
  }
}

// GET /api/policies
router.get("/", (_req, res) => {
  const rules = loadLocalRules();
  const jurisdictions = [...new Set(rules.map(r => r.jurisdiction))];
  res.json({ jurisdictions, ruleCount: rules.length });
});

// GET /api/policies/:jurisdiction
router.get("/:jurisdiction", (req, res) => {
  const { jurisdiction } = req.params;
  const rules = loadLocalRules().filter(
    r => r.jurisdiction === jurisdiction.toUpperCase()
  );
  if (rules.length === 0) {
    return res.status(404).json({ error: "No policy rules for jurisdiction" });
  }
  res.json({ jurisdiction: jurisdiction.toUpperCase(), rules });
});

// POST /api/policies/validate
// Body: { jurisdiction, legalMode, providerType, fraudSignals, riskScore }
router.post("/validate", (req, res) => {
  const { jurisdiction, legalMode, providerType, fraudSignals = [], riskScore = 0 } = req.body;

  if (!jurisdiction || !legalMode || !providerType) {
    return res.status(400).json({ error: "jurisdiction, legalMode, providerType required" });
  }

  const rules = loadLocalRules();
  const matchingRule = rules.find(r =>
    r.jurisdiction === jurisdiction.toUpperCase() &&
    r.legalModes.includes(legalMode) &&
    r.providerTypes.includes(providerType)
  );

  if (!matchingRule) {
    return res.json({
      valid:  false,
      reason: "No matching policy rule for the given jurisdiction/mode/provider combination",
    });
  }

  // Check blocked fraud signals
  const blockedSignals = (fraudSignals || []).filter(s =>
    (matchingRule.blockedFraudSignals || []).includes(s)
  );
  if (blockedSignals.length > 0) {
    return res.json({
      valid:          false,
      reason:         "blocked_fraud_signals",
      blockedSignals,
    });
  }

  // Check risk score threshold
  if (riskScore > matchingRule.maxRiskScore) {
    return res.json({
      valid:  false,
      reason: "risk_score_exceeds_threshold",
      maxRiskScore: matchingRule.maxRiskScore,
      actualRiskScore: riskScore,
    });
  }

  res.json({
    valid:       true,
    matchedRule: matchingRule.id,
    policy:      matchingRule,
  });
});

module.exports = router;
