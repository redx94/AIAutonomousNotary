const fs = require("fs");
const path = require("path");
const { expect } = require("chai");

const CompliantActOrchestrator = require("../../overlay/orchestrators/CompliantActOrchestrator");
const EventRecorder = require("../../overlay/evidence/EventRecorder");
const EventTypes = require("../../overlay/evidence/EventTypes");
const ProtocolPublicationService = require("../../overlay/services/ProtocolPublicationService");
const ContractPublicationAdapter = require("../../overlay/services/ContractPublicationAdapter");
const { buildConfig, buildValidInput } = require("./helpers");

describe("Compliance Overlay - evidence bundle", function () {
  it("creates a bundle on successful compliant flow", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });

    const result = await orchestrator.run(buildValidInput());

    expect(result.context.evidenceBundleId).to.be.a("string");
    expect(fs.existsSync(result.exportResult.bundleDirectory)).to.equal(true);
  });

  it("contains required artifact sections", async function () {
    const config = buildConfig();
    const orchestrator = new CompliantActOrchestrator({ config });
    const result = await orchestrator.run(buildValidInput());

    expect(result.exportResult.files).to.include("manifest.json");
    expect(result.exportResult.files).to.include("authority-execution.json");
    expect(result.exportResult.files).to.include("ceremony-record.json");
    expect(result.exportResult.files).to.include("protocol-publication.json");
  });

  it("includes a hash list and separates legal finalization from protocol publication", async function () {
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
          txHashes: ["0xbeadfeed"],
          publishedArtifacts: ["DocumentRegistryAnchor"],
        }),
      }),
    });
    const orchestrator = new CompliantActOrchestrator({
      config,
      eventRecorder,
      protocolPublicationService: publicationService,
    });

    const result = await orchestrator.run(buildValidInput());
    const hashesPath = path.join(result.exportResult.bundleDirectory, "hashes.json");
    const authorityPath = path.join(result.exportResult.bundleDirectory, "authority-execution.json");
    const publicationPath = path.join(result.exportResult.bundleDirectory, "protocol-publication.json");
    const ceremonyPath = path.join(result.exportResult.bundleDirectory, "ceremony-record.json");

    const hashes = JSON.parse(fs.readFileSync(hashesPath, "utf8"));
    const authorityExecution = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
    const publication = JSON.parse(fs.readFileSync(publicationPath, "utf8"));
    const ceremonyRecord = JSON.parse(fs.readFileSync(ceremonyPath, "utf8"));

    expect(hashes["authority-execution.json"]).to.be.a("string");
    expect(hashes["ceremony-record.json"]).to.be.a("string");
    expect(authorityExecution.finalRecordSigned).to.equal(true);
    expect(ceremonyRecord.artifactRef).to.equal("ceremony://test-artifact");
    expect(publication.publicationStatus).to.equal("published");
    expect(publication.publicationTxHashes).to.deep.equal(["0xbeadfeed"]);
  });
});
