const CeremonyRecord = require("../models/CeremonyRecord");
const {
  ValidationError,
  createId,
  nowIso,
  validateObject,
  validateString,
} = require("../utils/validation");

class CeremonyService {
  complete(context, reviewDecision, provider, input) {
    if (!reviewDecision.ceremonyConfirmed) {
      return {
        state: "blocked",
        confirmedAt: null,
        providerType: provider.getAuthorityMode(),
      };
    }

    if (context.legalMode === "compliant") {
      const ceremonyInput = validateObject(input, "CeremonyService.input");
      validateString(ceremonyInput.performedBy, "CeremonyService.input.performedBy");
      validateString(ceremonyInput.artifactRef, "CeremonyService.input.artifactRef");
      if (ceremonyInput.performedBy !== reviewDecision.reviewerId) {
        throw new ValidationError("Ceremony performer must match the human reviewer who approved the act");
      }
    }

    const ceremonyInput = input || {};
    const ceremonyRecord = new CeremonyRecord({
      ceremonyId: ceremonyInput.ceremonyId || createId("ceremony"),
      actId: context.actId,
      providerType: provider.getAuthorityMode(),
      performedBy: ceremonyInput.performedBy,
      artifactRef: ceremonyInput.artifactRef,
      notes: ceremonyInput.notes || "Human ceremony completed for compliant act execution.",
      completedAt: ceremonyInput.completedAt || nowIso(),
    });

    const providerCeremony = provider.administerCeremony(context, ceremonyRecord);
    return {
      state: providerCeremony.ceremonyStatus,
      confirmedAt: providerCeremony.ceremonyConfirmedAt,
      providerType: providerCeremony.providerType,
      ceremonyRecord,
    };
  }
}

module.exports = CeremonyService;
