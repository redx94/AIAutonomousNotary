const { expect } = require("chai");

const CompliantActOrchestrator = require("../../overlay/orchestrators/CompliantActOrchestrator");
const EventRecorder = require("../../overlay/evidence/EventRecorder");
const EventTypes = require("../../overlay/evidence/EventTypes");
const ProtocolPublicationService = require("../../overlay/services/ProtocolPublicationService");
const ContractPublicationAdapter = require("../../overlay/services/ContractPublicationAdapter");
const { buildConfig, buildValidInput } = require("./helpers");

describe("Compliance Overlay - compliant orchestrator", function () {
  it("succeeds on the happy path without on-chain publication", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(buildValidInput());

    expect(result.status).to.equal("completed");
    expect(result.authorityExecution.publicationStatus).to.equal("disabled");
    expect(result.exportResult.files).to.include("protocol-publication.json");
  });

  it("succeeds and then publishes on-chain through the downstream adapter", async function () {
    const config = buildConfig({
      PROTOCOL_PUBLICATION_MODE: "best_effort",
    });
    const eventRecorder = new EventRecorder();
    const publicationService = new ProtocolPublicationService({
      config,
      eventRecorder,
      eventTypes: EventTypes,
      adapter: new ContractPublicationAdapter({
        publishImplementation: async () => ({
          txHashes: ["0xabc123"],
          publishedArtifacts: ["NotaryNFTAttestation"],
        }),
      }),
    });

    const orchestrator = new CompliantActOrchestrator({
      config,
      eventRecorder,
      protocolPublicationService: publicationService,
    });

    const result = await orchestrator.run(buildValidInput());

    expect(result.status).to.equal("completed");
    expect(result.authorityExecution.publicationStatus).to.equal("published");
    expect(result.authorityExecution.publicationTxHashes).to.deep.equal(["0xabc123"]);
  });

  it("succeeds even if optional publication fails", async function () {
    const config = buildConfig({
      PROTOCOL_PUBLICATION_MODE: "best_effort",
    });
    const eventRecorder = new EventRecorder();
    const publicationService = new ProtocolPublicationService({
      config,
      eventRecorder,
      eventTypes: EventTypes,
      adapter: new ContractPublicationAdapter({
        publishImplementation: async () => {
          throw new Error("simulated publication failure");
        },
      }),
    });

    const orchestrator = new CompliantActOrchestrator({
      config,
      eventRecorder,
      protocolPublicationService: publicationService,
    });

    const result = await orchestrator.run(buildValidInput());

    expect(result.status).to.equal("completed_with_publication_failure");
    expect(result.authorityExecution.publicationStatus).to.equal("failed");
    expect(result.authorityExecution.publicationErrors[0]).to.include("simulated publication failure");
  });

  it("blocks incomplete compliant flow fail-closed", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(
      buildValidInput({
        review: {
          reviewerId: "reviewer-001",
          reviewerType: "commissioned_notary",
          decision: "approve",
          ceremonyConfirmed: true,
          finalApproval: false,
        },
      })
    );

    expect(result.status).to.equal("blocked");
    expect(result.error).to.include("missing final human signoff");
  });

  it("blocks when review input is absent in compliant mode", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(
      buildValidInput({
        review: undefined,
      })
    );

    expect(result.status).to.equal("blocked");
    expect(result.error).to.include("HumanReviewService.input");
  });

  it("blocks when ceremony artifact input is absent in compliant mode", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(
      buildValidInput({
        ceremony: undefined,
      })
    );

    expect(result.status).to.equal("blocked");
    expect(result.error).to.include("CeremonyService.input");
  });

  it("records the refusal path correctly", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(
      buildValidInput({
        review: {
          reviewerId: "reviewer-001",
          reviewerType: "commissioned_notary",
          decision: "refuse",
          ceremonyConfirmed: true,
          finalApproval: false,
          finalRefusal: true,
        },
      })
    );

    expect(result.status).to.equal("refused");
    expect(result.authorityExecution.executionOutcome).to.include("refused");
  });

  it("blocks when policy is missing", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(
      buildValidInput({
        jurisdiction: "CA",
      })
    );

    expect(result.status).to.equal("blocked");
    expect(result.policyDecision.blockReason).to.include("No policy found");
  });

  it("cannot publish before human-gated approval", async function () {
    const config = buildConfig({
      PROTOCOL_PUBLICATION_MODE: "best_effort",
    });
    let publishCalls = 0;
    const eventRecorder = new EventRecorder();
    const publicationService = new ProtocolPublicationService({
      config,
      eventRecorder,
      eventTypes: EventTypes,
      adapter: new ContractPublicationAdapter({
        publishImplementation: async () => {
          publishCalls += 1;
          return { txHashes: ["0xdeadbeef"], publishedArtifacts: ["NotaryNFTAttestation"] };
        },
      }),
    });

    const orchestrator = new CompliantActOrchestrator({
      config,
      eventRecorder,
      protocolPublicationService: publicationService,
    });

    const result = await orchestrator.run(
      buildValidInput({
        review: {
          reviewerId: "reviewer-001",
          reviewerType: "commissioned_notary",
          decision: "refuse",
          ceremonyConfirmed: true,
          finalApproval: false,
          finalRefusal: true,
        },
      })
    );

    expect(result.status).to.equal("refused");
    expect(publishCalls).to.equal(0);
  });

  it("uses actual produced artifacts for evidence gating", async function () {
    const config = buildConfig();
    const evidenceBundleService = {
      previewArtifacts() {
        return ["manifest.json"];
      },
      createBundle(context) {
        return {
          bundleId: `${context.actId}-bundle`,
        };
      },
      exportBundle(bundleId) {
        return {
          bundleId,
          files: ["manifest.json"],
          bundleDirectory: config.EVIDENCE_OUTPUT_DIR,
        };
      },
    };
    const orchestrator = new CompliantActOrchestrator({
      config,
      evidenceBundleService,
    });

    const result = await orchestrator.run(buildValidInput());

    expect(result.status).to.equal("blocked");
    expect(result.error).to.include("missing required evidence artifacts");
  });
});
