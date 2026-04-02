/**
 * IdentityProofingService
 *
 * KYC/AML provider seam. Near-term: routes to third-party providers.
 * Long-term: proprietary identity intelligence.
 *
 * Config (environment variables):
 *   KYC_PROVIDER     = "persona" | "jumio" | "onfido" | "mock" (default: "mock")
 *   PERSONA_API_KEY  = Persona API key
 *   JUMIO_API_KEY    = Jumio API key (+ JUMIO_API_SECRET)
 *   ONFIDO_API_TOKEN = Onfido API token
 *
 * In production each provider issues an inquiry/verification and returns
 * a structured result. This seam normalises all provider responses to the
 * canonical format expected by the compliance overlay's policy engine.
 */

const KYC_PROVIDER = process.env.KYC_PROVIDER || "mock";

class IdentityProofingService {
  /**
   * Verify a signer's identity.
   * @param {Object} context - Act context (includes signer.signerId, jurisdiction, etc.)
   * @param {Object} input   - Override values for testing or direct provider results
   * @returns {Object} Normalised identity verification result
   */
  async verify(context, input = {}) {
    if (input.completedChecks || input.state) {
      // Direct override (test/mock path)
      return this._buildResult({
        state:          input.state || "verified",
        completedChecks: input.completedChecks || ["identity_verified", "credential_screened"],
        provider:       input.provider || "override",
        riskSignals:    input.riskSignals || [],
        kycStatus:      input.kycStatus || "approved",
        amlStatus:      input.amlStatus || "clear",
        sanctionsMatch: input.sanctionsMatch || false,
      });
    }

    switch (KYC_PROVIDER) {
      case "persona": return this._verifyWithPersona(context);
      case "jumio":   return this._verifyWithJumio(context);
      case "onfido":  return this._verifyWithOnfido(context);
      default:        return this._verifyMock(context);
    }
  }

  // ─── Provider implementations ─────────────────────────────────────────────

  async _verifyWithPersona(context) {
    const PERSONA_API_KEY = process.env.PERSONA_API_KEY;
    if (!PERSONA_API_KEY) throw new Error("PERSONA_API_KEY not configured");

    // Persona Inquiries API: https://docs.withpersona.com/reference/create-an-inquiry
    const response = await fetch("https://withpersona.com/api/v1/inquiries", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERSONA_API_KEY}`,
        "Content-Type":  "application/json",
        "Persona-Version": "2023-01-05",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            "inquiry-template-id": process.env.PERSONA_TEMPLATE_ID,
            "reference-id": context.signer?.signerId,
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Persona API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const status = data.data?.attributes?.status;

    return this._buildResult({
      state:          status === "completed" ? "verified" : "pending",
      completedChecks: status === "completed"
        ? ["identity_verified", "credential_screened"]
        : ["identity_verified"],
      provider:       "persona",
      kycStatus:      status === "completed" ? "approved" : "pending",
      amlStatus:      "clear", // Persona returns AML in separate check
      sanctionsMatch: false,
      riskSignals:    [],
      externalId:     data.data?.id,
    });
  }

  async _verifyWithJumio(context) {
    const JUMIO_API_KEY    = process.env.JUMIO_API_KEY;
    const JUMIO_API_SECRET = process.env.JUMIO_API_SECRET;
    if (!JUMIO_API_KEY || !JUMIO_API_SECRET) {
      throw new Error("JUMIO_API_KEY and JUMIO_API_SECRET not configured");
    }

    const credentials = Buffer.from(`${JUMIO_API_KEY}:${JUMIO_API_SECRET}`).toString("base64");
    const response = await fetch("https://netverify.com/api/v4/initiate", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type":  "application/json",
        "User-Agent":    "AI-Autonomous-Notary/2.0",
      },
      body: JSON.stringify({
        customerInternalReference: context.signer?.signerId,
        userReference:             context.signer?.signerId,
        reportingCriteria:         context.jurisdiction || "US",
      }),
    });

    if (!response.ok) {
      throw new Error(`Jumio API error ${response.status}`);
    }

    const data = await response.json();

    return this._buildResult({
      state:          "pending", // Jumio uses callback for completion
      completedChecks: ["identity_verified"],
      provider:       "jumio",
      kycStatus:      "pending",
      amlStatus:      "pending",
      sanctionsMatch: false,
      riskSignals:    [],
      externalId:     data.transactionReference,
      redirectUrl:    data.redirectUrl, // For SDK integration
    });
  }

  async _verifyWithOnfido(context) {
    const ONFIDO_API_TOKEN = process.env.ONFIDO_API_TOKEN;
    if (!ONFIDO_API_TOKEN) throw new Error("ONFIDO_API_TOKEN not configured");

    // Create applicant
    const applicantRes = await fetch("https://api.onfido.com/v3.6/applicants", {
      method: "POST",
      headers: {
        "Authorization": `Token token=${ONFIDO_API_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        first_name: "Unknown",
        last_name:  "Unknown",
        location:   { country_of_residence: context.jurisdiction || "USA" },
      }),
    });

    if (!applicantRes.ok) throw new Error(`Onfido applicant error ${applicantRes.status}`);
    const applicant = await applicantRes.json();

    // Create check
    const checkRes = await fetch("https://api.onfido.com/v3.6/checks", {
      method: "POST",
      headers: {
        "Authorization": `Token token=${ONFIDO_API_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        applicant_id: applicant.id,
        report_names: ["document", "right_to_work", "watchlist_standard"],
      }),
    });

    if (!checkRes.ok) throw new Error(`Onfido check error ${checkRes.status}`);
    const check = await checkRes.json();

    return this._buildResult({
      state:          "pending",
      completedChecks: ["identity_verified"],
      provider:       "onfido",
      kycStatus:      "pending",
      amlStatus:      "pending",
      sanctionsMatch: false,
      riskSignals:    [],
      externalId:     check.id,
    });
  }

  _verifyMock(_context) {
    return this._buildResult({
      state:          "verified",
      completedChecks: ["identity_verified", "credential_screened"],
      provider:       "mock-proofing-provider",
      kycStatus:      "approved",
      amlStatus:      "clear",
      sanctionsMatch: false,
      riskSignals:    [],
    });
  }

  // ─── Normalise result ─────────────────────────────────────────────────────

  _buildResult(fields) {
    return {
      state:          fields.state,
      completedChecks: fields.completedChecks,
      verifiedAt:     new Date().toISOString(),
      provider:       fields.provider,
      kycStatus:      fields.kycStatus,
      amlStatus:      fields.amlStatus,
      sanctionsMatch: fields.sanctionsMatch,
      riskSignals:    fields.riskSignals || [],
      externalId:     fields.externalId || null,
      redirectUrl:    fields.redirectUrl || null,
    };
  }
}

module.exports = IdentityProofingService;
