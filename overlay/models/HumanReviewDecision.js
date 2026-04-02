const {
  validateBoolean,
  validateObject,
  validatePlainObjectMap,
  validateString,
  validateTimestamp,
} = require("../utils/validation");

class HumanReviewDecision {
  constructor(payload) {
    const value = validateObject(payload, "HumanReviewDecision");
    validateString(value.reviewId, "HumanReviewDecision.reviewId");
    validateString(value.reviewerId, "HumanReviewDecision.reviewerId");
    validateString(value.reviewerType, "HumanReviewDecision.reviewerType");
    validateString(value.reviewedAIAnalysisId, "HumanReviewDecision.reviewedAIAnalysisId");
    validateString(value.decision, "HumanReviewDecision.decision");
    validatePlainObjectMap(value.overrides, "HumanReviewDecision.overrides");
    validateString(value.notes, "HumanReviewDecision.notes");
    validateBoolean(value.ceremonyConfirmed, "HumanReviewDecision.ceremonyConfirmed");
    validateBoolean(value.finalApproval, "HumanReviewDecision.finalApproval");
    validateBoolean(value.finalRefusal, "HumanReviewDecision.finalRefusal");
    validateTimestamp(value.completedAt, "HumanReviewDecision.completedAt");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = HumanReviewDecision;
