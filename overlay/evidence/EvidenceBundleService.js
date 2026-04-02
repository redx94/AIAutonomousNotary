const EvidenceBundleServiceInterface = require("../interfaces/EvidenceBundleService");
const buildBundle = require("./bundles/buildBundle");
const exportBundle = require("./exports/exportBundle");

class EvidenceBundleService extends EvidenceBundleServiceInterface {
  constructor(options = {}) {
    super();
    this.outputRoot = options.outputRoot;
    this.bundles = new Map();
  }

  createBundle(context, policyDecision, aiAnalysis, humanReview, ceremonyRecord, authorityExecution, events = []) {
    const bundle = buildBundle({
      context,
      policyDecision,
      aiAnalysis,
      humanReview,
      ceremonyRecord,
      authorityExecution,
      events,
    });
    this.bundles.set(bundle.bundleId, {
      bundleId: bundle.bundleId,
      sources: {
        context,
        policyDecision,
        aiAnalysis,
        humanReview,
        ceremonyRecord,
        authorityExecution,
        events,
      },
    });
    return bundle;
  }

  exportBundle(bundleId, format = "json") {
    if (format !== "json") {
      throw new Error(`Unsupported evidence bundle export format: ${format}`);
    }

    const bundleEntry = this.bundles.get(bundleId);
    if (!bundleEntry) {
      throw new Error(`Unknown evidence bundle: ${bundleId}`);
    }

    const bundle = buildBundle({
      ...bundleEntry.sources,
      bundleId,
    });
    return exportBundle(bundle, this.outputRoot);
  }

  previewArtifacts(context, policyDecision, aiAnalysis, humanReview, ceremonyRecord, authorityExecution, events = []) {
    const previewBundle = buildBundle({
      context,
      policyDecision,
      aiAnalysis,
      humanReview,
      ceremonyRecord,
      authorityExecution,
      events,
    });

    return previewBundle.manifest.includedArtifacts;
  }
}

module.exports = EvidenceBundleService;
