const {
  validateObject,
  validatePlainObjectMap,
  validateString,
  validateStringArray,
  validateTimestamp,
} = require("../utils/validation");

class EvidenceBundleManifest {
  constructor(payload) {
    const value = validateObject(payload, "EvidenceBundleManifest");
    validateString(value.bundleId, "EvidenceBundleManifest.bundleId");
    validateString(value.actId, "EvidenceBundleManifest.actId");
    validateStringArray(value.includedArtifacts, "EvidenceBundleManifest.includedArtifacts");
    validatePlainObjectMap(value.hashIndex, "EvidenceBundleManifest.hashIndex");
    validatePlainObjectMap(value.retentionPolicy, "EvidenceBundleManifest.retentionPolicy");
    validateString(value.exportFormatVersion, "EvidenceBundleManifest.exportFormatVersion");
    validateTimestamp(value.createdAt, "EvidenceBundleManifest.createdAt");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = EvidenceBundleManifest;
