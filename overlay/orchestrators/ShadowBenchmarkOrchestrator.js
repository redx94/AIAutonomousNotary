const AutonomousAuthorityProvider = require("../authority/autonomous/AutonomousAuthorityProvider");
const { ValidationError } = require("../utils/validation");

class ShadowBenchmarkOrchestrator {
  constructor(options = {}) {
    this.config = options.config;
    this.compliantOrchestrator = options.compliantOrchestrator;
    this.autonomousProvider = options.autonomousProvider || new AutonomousAuthorityProvider();
  }

  async run(input) {
    if (!this.config.ENABLE_SHADOW_AUTONOMOUS_BENCHMARKING) {
      throw new ValidationError("Shadow autonomous benchmarking is disabled by configuration");
    }

    const compliantResult = await this.compliantOrchestrator.run(input);
    const shadowContext = compliantResult.context;

    let autonomousPreview = null;
    try {
      autonomousPreview = this.autonomousProvider.authorizeAct(
        {
          ...shadowContext,
          legalMode: "experimental",
          activeAuthorityProvider: "autonomous",
        },
        compliantResult.policyDecision,
        compliantResult.humanReview
      );
    } catch (error) {
      autonomousPreview = {
        providerType: "autonomous",
        previewStatus: "blocked",
        reason: error.message,
      };
    }

    return {
      compliantResult,
      autonomousPreview,
      benchmarkSummary: {
        humanOutcome: compliantResult.status,
        autonomousProviderMode: "autonomous",
        autonomousPreviewStatus: autonomousPreview.executionOutcome || autonomousPreview.previewStatus,
      },
    };
  }
}

module.exports = ShadowBenchmarkOrchestrator;
