const loadConfig = require("../../overlay/config/loadConfig");
const CompliantActOrchestrator = require("../../overlay/orchestrators/CompliantActOrchestrator");
const EventRecorder = require("../../overlay/evidence/EventRecorder");
const EventTypes = require("../../overlay/evidence/EventTypes");
const ProtocolPublicationService = require("../../overlay/services/ProtocolPublicationService");
const ContractPublicationAdapter = require("../../overlay/services/ContractPublicationAdapter");

function buildSampleInput() {
  return {
    jurisdiction: "US",
    signerLocation: "US",
    authorityLocation: "US",
    signer: {
      displayName: "Sample Signer",
      email: "sample.signer@example.com",
    },
    document: {
      documentType: "contract",
      documentContent: "Sample compliant document content for AI Autonomous Notary overlay flow.",
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
      artifactRef: "ceremony://sample-compliant-recording",
      notes: "Sample human ceremony artifact for compliant overlay flow.",
    },
  };
}

async function main() {
  const config = loadConfig();
  const eventRecorder = new EventRecorder();
  const adapter =
    process.env.SIMULATE_PROTOCOL_PUBLICATION === "true"
      ? new ContractPublicationAdapter({
          publishImplementation: async (context) => ({
            txHashes: [`0x${context.actId.replace(/[^a-f0-9]/gi, "").slice(0, 16).padEnd(16, "0")}`],
            publishedArtifacts: ["NotaryNFTAttestation"],
          }),
        })
      : new ContractPublicationAdapter();

  const protocolPublicationService = new ProtocolPublicationService({
    config,
    adapter,
    eventRecorder,
    eventTypes: EventTypes,
  });

  const orchestrator = new CompliantActOrchestrator({
    config,
    eventRecorder,
    protocolPublicationService,
  });

  const result = await orchestrator.run(buildSampleInput());
  console.log(
    JSON.stringify(
      {
        status: result.status,
        actId: result.context.actId,
        evidenceBundleId: result.context.evidenceBundleId,
        publicationStatus: result.authorityExecution
          ? result.authorityExecution.publicationStatus
          : "not_applicable",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Compliance flow failed:", error);
  process.exit(1);
});
