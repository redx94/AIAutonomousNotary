const AIAnalysisResult = require("../models/AIAnalysisResult");
const { createId, nowIso } = require("../utils/validation");

class AIAnalysisService {
  analyze(context, input = {}) {
    return new AIAnalysisResult({
      analysisId: createId("analysis"),
      documentFindings: input.documentFindings || [
        {
          type: "document_integrity",
          result: "no_material_anomalies_detected",
          documentId: context.documentId,
        },
      ],
      identityFindings: input.identityFindings || [
        {
          type: "identity_consistency",
          result: "consistent",
          signerId: context.signer.signerId,
        },
      ],
      fraudSignals: input.fraudSignals || [],
      riskScore: input.riskScore !== undefined ? input.riskScore : 25,
      recommendation: input.recommendation || "approve_with_human_review",
      confidence: input.confidence !== undefined ? input.confidence : 0.88,
      advisoryOnly: input.advisoryOnly !== undefined ? input.advisoryOnly : true,
      generatedAt: input.generatedAt || nowIso(),
    });
  }
}

module.exports = AIAnalysisService;
