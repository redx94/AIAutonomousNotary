const HumanReviewDecision = require("../models/HumanReviewDecision");
const {
  ValidationError,
  createId,
  nowIso,
  validateBoolean,
  validateObject,
  validateString,
} = require("../utils/validation");

class HumanReviewService {
  openReview(context, aiAnalysis) {
    return {
      reviewSessionId: createId("review-session"),
      actId: context.actId,
      analysisId: aiAnalysis.analysisId,
      openedAt: nowIso(),
    };
  }

  completeReview(context, aiAnalysis, input) {
    let reviewInput = input || {};

    if (context.legalMode === "compliant") {
      reviewInput = validateObject(input, "HumanReviewService.input");
      validateString(reviewInput.reviewerId, "HumanReviewService.input.reviewerId");
      validateString(reviewInput.reviewerType, "HumanReviewService.input.reviewerType");
      validateString(reviewInput.decision, "HumanReviewService.input.decision");
      validateBoolean(reviewInput.ceremonyConfirmed, "HumanReviewService.input.ceremonyConfirmed");
      validateBoolean(reviewInput.finalApproval, "HumanReviewService.input.finalApproval");

      if (!["approve", "refuse"].includes(reviewInput.decision)) {
        throw new ValidationError("HumanReviewService.input.decision must be approve or refuse");
      }
    }

    return new HumanReviewDecision({
      reviewId: createId("review"),
      reviewerId: reviewInput.reviewerId || "human-reviewer-001",
      reviewerType: reviewInput.reviewerType || "commissioned_notary",
      reviewedAIAnalysisId: aiAnalysis.analysisId,
      decision: reviewInput.decision || "approve",
      overrides: reviewInput.overrides || {},
      notes: reviewInput.notes || "Human reviewer confirmed AI output is advisory-only.",
      ceremonyConfirmed: reviewInput.ceremonyConfirmed !== undefined ? reviewInput.ceremonyConfirmed : true,
      finalApproval: reviewInput.finalApproval !== undefined ? reviewInput.finalApproval : true,
      finalRefusal:
        reviewInput.finalRefusal !== undefined
          ? reviewInput.finalRefusal
          : reviewInput.decision === "refuse",
      completedAt: reviewInput.completedAt || nowIso(),
    });
  }
}

module.exports = HumanReviewService;
