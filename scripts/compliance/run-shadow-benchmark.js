const loadConfig = require("../../overlay/config/loadConfig");
const CompliantActOrchestrator = require("../../overlay/orchestrators/CompliantActOrchestrator");
const ShadowBenchmarkOrchestrator = require("../../overlay/orchestrators/ShadowBenchmarkOrchestrator");

function buildSampleInput() {
  return {
    jurisdiction: "US",
    signerLocation: "US",
    authorityLocation: "US",
    signer: {
      displayName: "Shadow Benchmark Signer",
      email: "shadow.benchmark@example.com",
    },
    document: {
      documentType: "contract",
      documentContent: "Shadow benchmark sample content.",
    },
    review: {
      reviewerId: "reviewer-001",
      reviewerType: "commissioned_notary",
      decision: "approve",
      ceremonyConfirmed: true,
      finalApproval: true,
      finalRefusal: false,
    },
    ceremony: {
      performedBy: "reviewer-001",
      artifactRef: "ceremony://shadow-benchmark-artifact",
      notes: "Shadow benchmark human ceremony artifact.",
    },
  };
}

async function main() {
  const config = loadConfig({
    ENABLE_SHADOW_AUTONOMOUS_BENCHMARKING: true,
  });
  const compliantOrchestrator = new CompliantActOrchestrator({ config });
  const shadowOrchestrator = new ShadowBenchmarkOrchestrator({
    config,
    compliantOrchestrator,
  });

  const result = await shadowOrchestrator.run(buildSampleInput());
  console.log(JSON.stringify(result.benchmarkSummary, null, 2));
}

main().catch((error) => {
  console.error("Shadow benchmark failed:", error);
  process.exit(1);
});
