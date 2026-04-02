const { createHash } = require("crypto");
const { createId, validateObject, validateString } = require("../utils/validation");

class DocumentIntakeService {
  intake(input) {
    const document = validateObject(input, "DocumentIntakeService.input");
    validateString(document.documentType, "DocumentIntakeService.input.documentType");
    validateString(document.documentContent, "DocumentIntakeService.input.documentContent");
    validateString(document.documentId || createId("document"), "DocumentIntakeService.input.documentId");

    return {
      documentId: document.documentId || createId("document"),
      documentType: document.documentType,
      documentHash:
        document.documentHash ||
        createHash("sha256").update(document.documentContent).digest("hex"),
      documentContent: document.documentContent,
    };
  }
}

module.exports = DocumentIntakeService;
