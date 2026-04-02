class EvidenceBundleService {
  createBundle() {
    throw new Error("EvidenceBundleService.createBundle must be implemented");
  }

  exportBundle() {
    throw new Error("EvidenceBundleService.exportBundle must be implemented");
  }
}

module.exports = EvidenceBundleService;
