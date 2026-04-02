/**
 * AIAnalysisService
 *
 * Hybrid AI provider seam.
 * Near-term: third-party APIs (OpenAI, AWS Rekognition, custom ML endpoints).
 * Mid/long-term: proprietary models for fraud scoring, NLP, and document intelligence.
 *
 * Config (environment variables):
 *   AI_PROVIDER    = "openai" | "aws" | "mock" (default: "mock")
 *   OPENAI_API_KEY = OpenAI API key
 */

const AIAnalysisResult = require("../models/AIAnalysisResult");
const { createId, nowIso } = require("../utils/validation");

const AI_PROVIDER = process.env.AI_PROVIDER || "mock";

class AIAnalysisService {
  /**
   * Analyse a document context.
   * @param {Object} context - Act context
   * @param {Object} input   - Override values (for testing or direct results)
   * @returns {AIAnalysisResult}
   */
  async analyze(context, input = {}) {
    if (this._isOverride(input)) {
      return new AIAnalysisResult(this._buildResult(context, input));
    }

    let result;
    switch (AI_PROVIDER) {
      case "openai": result = await this._analyzeWithOpenAI(context); break;
      default:       result = this._analyzeWithMock(context, input);  break;
    }
    return new AIAnalysisResult(result);
  }

  // ─── Provider implementations ─────────────────────────────────────────────

  async _analyzeWithOpenAI(context) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.warn("[AI] OPENAI_API_KEY not configured — falling back to mock");
      return this._analyzeWithMock(context);
    }

    const prompt = `You are a legal document analysis AI for a notary protocol.
Analyze the document with hash "${context.documentHash}" of type "${context.documentType}" in jurisdiction "${context.jurisdiction}".
Respond with valid JSON matching exactly:
{
  "riskScore": <integer 0-100>,
  "recommendation": "approve_with_human_review" | "approve" | "reject",
  "confidence": <float 0.0-1.0>,
  "fraudSignals": [<string>],
  "documentFindings": [{"type": string, "result": string}],
  "identityFindings": [{"type": string, "result": string}]
}`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:           "gpt-4o",
          messages:        [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens:      400,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
      const data   = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);

      return this._buildResult(context, {
        riskScore:        parsed.riskScore,
        recommendation:   parsed.recommendation,
        confidence:       parsed.confidence,
        fraudSignals:     parsed.fraudSignals,
        documentFindings: parsed.documentFindings,
        identityFindings: parsed.identityFindings,
        provider:         "openai",
      });
    } catch (err) {
      console.error("[AI] OpenAI analysis failed, falling back to mock:", err.message);
      return this._analyzeWithMock(context);
    }
  }

  _analyzeWithMock(context, input = {}) {
    return this._buildResult(context, {
      riskScore:        input.riskScore !== undefined ? input.riskScore : 25,
      recommendation:   input.recommendation || "approve_with_human_review",
      confidence:       input.confidence !== undefined ? input.confidence : 0.88,
      fraudSignals:     input.fraudSignals || [],
      documentFindings: input.documentFindings || [
        { type: "document_integrity", result: "no_material_anomalies_detected", documentId: context.documentId },
      ],
      identityFindings: input.identityFindings || [
        { type: "identity_consistency", result: "consistent", signerId: context.signer?.signerId },
      ],
      provider:         "mock",
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _isOverride(input) {
    return input.riskScore !== undefined ||
           input.recommendation !== undefined ||
           input.confidence !== undefined ||
           (input.documentFindings && input.documentFindings.length > 0) ||
           (input.fraudSignals && input.fraudSignals.length > 0);
  }

  _buildResult(context, fields) {
    return {
      analysisId:       createId("analysis"),
      documentFindings: fields.documentFindings || [],
      identityFindings: fields.identityFindings || [],
      fraudSignals:     fields.fraudSignals || [],
      riskScore:        fields.riskScore !== undefined ? fields.riskScore : 25,
      recommendation:   fields.recommendation || "approve_with_human_review",
      confidence:       fields.confidence !== undefined ? fields.confidence : 0.88,
      advisoryOnly:     true,
      provider:         fields.provider || AI_PROVIDER,
      generatedAt:      fields.generatedAt || nowIso(),
    };
  }
}

module.exports = AIAnalysisService;
