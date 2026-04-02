class ContractPublicationAdapter {
  constructor(options = {}) {
    this.publishImplementation = options.publishImplementation || null;
  }

  async publish(context, evidenceBundle) {
    if (!this.publishImplementation) {
      throw new Error(
        `No contract publication adapter configured for act ${context.actId}; on-chain publication remains optional`
      );
    }

    return this.publishImplementation(context, evidenceBundle);
  }
}

module.exports = ContractPublicationAdapter;
