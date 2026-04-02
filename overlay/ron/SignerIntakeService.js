const { createId, validateSigner } = require("../utils/validation");

class SignerIntakeService {
  intake(input) {
    const signer = validateSigner(
      {
        signerId: input.signerId || createId("signer"),
        displayName: input.displayName,
        email: input.email,
      },
      "SignerIntakeService.input"
    );

    return signer;
  }
}

module.exports = SignerIntakeService;
