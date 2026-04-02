class AuthorityProvider {
  validateAuthorityEligibility() {
    throw new Error("AuthorityProvider.validateAuthorityEligibility must be implemented");
  }

  getAuthorityMode() {
    throw new Error("AuthorityProvider.getAuthorityMode must be implemented");
  }

  authorizeAct() {
    throw new Error("AuthorityProvider.authorizeAct must be implemented");
  }

  refuseAct() {
    throw new Error("AuthorityProvider.refuseAct must be implemented");
  }

  administerCeremony() {
    throw new Error("AuthorityProvider.administerCeremony must be implemented");
  }

  completeCertificate() {
    throw new Error("AuthorityProvider.completeCertificate must be implemented");
  }

  signFinalRecord() {
    throw new Error("AuthorityProvider.signFinalRecord must be implemented");
  }

  getAuditMetadata() {
    throw new Error("AuthorityProvider.getAuditMetadata must be implemented");
  }
}

module.exports = AuthorityProvider;
