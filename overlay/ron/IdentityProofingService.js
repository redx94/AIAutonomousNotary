class IdentityProofingService {
  verify(_context, input = {}) {
    const completedChecks = input.completedChecks || ["identity_verified", "credential_screened"];
    const state = input.state || "verified";
    return {
      state,
      completedChecks,
      verifiedAt: input.verifiedAt || new Date().toISOString(),
      provider: input.provider || "mock-proofing-provider",
    };
  }
}

module.exports = IdentityProofingService;
