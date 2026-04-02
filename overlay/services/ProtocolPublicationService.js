const ContractPublicationAdapter = require("./ContractPublicationAdapter");

class ProtocolPublicationService {
  constructor(options = {}) {
    this.config = options.config;
    this.adapter = options.adapter || new ContractPublicationAdapter();
    this.eventRecorder = options.eventRecorder;
    this.eventTypes = options.eventTypes;
  }

  async publish(context, authorityExecution, evidenceBundle) {
    const publicationMode = this.config.PROTOCOL_PUBLICATION_MODE;
    authorityExecution.publicationMode = publicationMode;

    if (publicationMode === "disabled") {
      authorityExecution.publicationAttempted = false;
      authorityExecution.publicationStatus = "disabled";
      return authorityExecution;
    }

    if (!authorityExecution.certificateCompleted || !authorityExecution.finalRecordSigned) {
      throw new Error("Protocol publication cannot run before off-chain finalization is complete");
    }

    authorityExecution.publicationAttempted = true;
    this.eventRecorder.record(this.eventTypes.PROTOCOL_PUBLICATION_ATTEMPTED, {
      actId: context.actId,
      bundleId: evidenceBundle.bundleId,
      publicationMode,
    });

    try {
      const publicationResult = await this.adapter.publish(context, evidenceBundle);
      authorityExecution.publicationStatus = "published";
      authorityExecution.publicationTxHashes = publicationResult.txHashes || [];
      authorityExecution.publicationErrors = [];
      authorityExecution.publishedArtifacts = publicationResult.publishedArtifacts || [];

      this.eventRecorder.record(this.eventTypes.PROTOCOL_PUBLICATION_SUCCEEDED, {
        actId: context.actId,
        txHashes: authorityExecution.publicationTxHashes,
      });
    } catch (error) {
      authorityExecution.publicationStatus = "failed";
      authorityExecution.publicationErrors = [error.message];
      authorityExecution.publicationTxHashes = [];
      authorityExecution.publishedArtifacts = [];

      this.eventRecorder.record(this.eventTypes.PROTOCOL_PUBLICATION_FAILED, {
        actId: context.actId,
        error: error.message,
      });

      if (publicationMode === "required_for_protocol_sync") {
        authorityExecution.executionOutcome = "authorized_with_publication_failure";
      }
    }

    return authorityExecution;
  }
}

module.exports = ProtocolPublicationService;
