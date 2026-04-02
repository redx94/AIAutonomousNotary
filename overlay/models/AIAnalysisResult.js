const {
  validateArray,
  validateBoolean,
  validateNumber,
  validateObject,
  validateString,
  validateTimestamp,
} = require("../utils/validation");

class AIAnalysisResult {
  constructor(payload) {
    const value = validateObject(payload, "AIAnalysisResult");
    validateString(value.analysisId, "AIAnalysisResult.analysisId");
    validateArray(value.documentFindings, "AIAnalysisResult.documentFindings");
    validateArray(value.identityFindings, "AIAnalysisResult.identityFindings");
    validateArray(value.fraudSignals, "AIAnalysisResult.fraudSignals");
    validateNumber(value.riskScore, "AIAnalysisResult.riskScore", { min: 0, max: 100 });
    validateString(value.recommendation, "AIAnalysisResult.recommendation");
    validateNumber(value.confidence, "AIAnalysisResult.confidence", { min: 0, max: 1 });
    validateBoolean(value.advisoryOnly, "AIAnalysisResult.advisoryOnly");
    validateTimestamp(value.generatedAt, "AIAnalysisResult.generatedAt");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = AIAnalysisResult;
