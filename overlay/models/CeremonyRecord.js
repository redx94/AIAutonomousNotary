const { validateObject, validateString, validateTimestamp } = require("../utils/validation");

class CeremonyRecord {
  constructor(payload) {
    const value = validateObject(payload, "CeremonyRecord");
    validateString(value.ceremonyId, "CeremonyRecord.ceremonyId");
    validateString(value.actId, "CeremonyRecord.actId");
    validateString(value.providerType, "CeremonyRecord.providerType");
    validateString(value.performedBy, "CeremonyRecord.performedBy");
    validateString(value.artifactRef, "CeremonyRecord.artifactRef");
    validateString(value.notes, "CeremonyRecord.notes");
    validateTimestamp(value.completedAt, "CeremonyRecord.completedAt");

    Object.assign(this, value);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = CeremonyRecord;
