# Identity Verification Integration Path

## Purpose

Production identity proofing is an explicit next-stage capital unlock. The compliance overlay already defines where identity verification fits in the authority flow (step 4: Identity Proofing), but the actual integration with an external IDV vendor is not yet wired. This document specifies the integration surface, the candidate vendors, and the hookup points in the existing overlay code.

---

## Where IDV Fits in the Compliant Flow

```
Signer Intake
  → Document Intake
  → AI Analysis (advisory)
  → [Identity Proofing]  ← integration point
  → Policy Evaluation
  → Human Review
  → Ceremony
  → Finalization
  → Evidence Bundle
  → Optional Publication
```

The overlay's `overlay/orchestrators/CompliantActOrchestrator.js` calls the identity step before policy evaluation. A failed or incomplete identity check must block progression — the gate logic in `overlay/gates/` enforces this when `LEGAL_MODE=compliant`.

---

## Minimum Required IDV Output

For a compliant notarization act, the identity proofing step must produce:

| Field | Description |
|-------|-------------|
| `verifiedIdentity.fullName` | Legal name as verified |
| `verifiedIdentity.dateOfBirth` | DOB from government-issued document |
| `verifiedIdentity.documentType` | e.g. `PASSPORT`, `DRIVERS_LICENSE`, `NATIONAL_ID` |
| `verifiedIdentity.documentNumber` | Redacted or hashed for evidence bundle |
| `verifiedIdentity.issuingJurisdiction` | Country/state |
| `verifiedIdentity.verificationLevel` | e.g. `IAL1`, `IAL2`, `NIST_IAL2` |
| `verifiedIdentity.vendorSessionId` | Vendor-assigned session reference |
| `verifiedIdentity.timestamp` | ISO 8601 verification timestamp |
| `verifiedIdentity.liveness` | `true/false` — liveness check result |
| `verifiedIdentity.riskScore` | Vendor risk/confidence score (0–100) |

This output must be recorded in the evidence bundle under `ai-analysis.json` (as an advisory input) and referenced in `authority-execution.json` as a prerequisite to finalization.

---

## Candidate Vendors

### 1. Persona (Recommended First)

**Why:** Persona is a composable identity platform. Its API-first design, webhook support, and case-management model maps directly onto the overlay's orchestration pattern. It supports government ID verification, liveness detection, database lookups, and custom workflow configuration — which is useful for jurisdiction-specific RON requirements.

**Key capabilities:**
- Government document capture and OCR
- Selfie liveness and biometric matching
- Knowledge-Based Authentication (KBA) — required by several RON jurisdictions
- Webhook events for async verification results
- Inquiry API for session-based identity checks

**Integration surface:**
```
POST /api/v1/inquiries          → create identity session, return inquiry_id
GET  /api/v1/inquiries/{id}     → poll for completion
POST /webhooks/persona          → receive async result in overlay event handler
```

**Overlay hookup:** Create `overlay/services/identityService.js` with a Persona adapter. The adapter accepts a `caseId` and `signerId`, initiates an inquiry, and emits an `IDENTITY_PROOFING_COMPLETE` or `IDENTITY_PROOFING_FAILED` event to the evidence spine.

**Environment variables needed:**
```
PERSONA_API_KEY=
PERSONA_TEMPLATE_ID=
PERSONA_WEBHOOK_SECRET=
```

---

### 2. Socure

**Why:** Socure positions as AI-powered identity, risk, and compliance. It has strong coverage for KYC/AML use cases and is used by financial institutions. If the target buyer is a mortgage/title operator (Qualia, Pavaso, Stavvy), Socure's credentialing story resonates with their compliance teams.

**Key capabilities:**
- DocV (document verification) — government ID + selfie
- Sigma Identity Fraud score
- KYC compliance output
- PII data extraction from documents

**Integration surface:**
```
POST /api/3.0/EmailAuthScore     → risk score for email
POST /api/3.0/docv/request       → document verification session
```

**Overlay hookup:** Same adapter pattern as Persona. Socure's `docv` output maps to the `verifiedIdentity` schema above.

---

### 3. AU10TIX

**Why:** AU10TIX is focused on document verification and identity authentication with specific strength in KYC/AML workflows. Useful if the initial wedge involves high-risk documents (financial deeds, title instruments) where document authenticity (not just person identity) matters.

**Key capabilities:**
- Document liveness and forgery detection
- MRZ and barcode reading
- KYC workflow integration
- AML watchlist screening integration

**Overlay hookup:** Similar adapter. AU10TIX adds document-level forgery signals that can feed the AI advisory risk score in `overlay/evidence/`.

---

## Implementation Checklist

```
[ ] Create overlay/services/identityService.js
      - adapter interface: initiate(caseId, signerId) → sessionId
      - adapter interface: getResult(sessionId) → VerifiedIdentity | null
      - vendor adapters: PersonaAdapter, SocureAdapter, AU10TIXAdapter
      - environment-driven vendor selection: IDENTITY_PROVIDER=persona|socure|au10tix

[ ] Wire identityService into CompliantActOrchestrator
      - call after AI analysis step
      - emit IDENTITY_PROOFING_STARTED event
      - emit IDENTITY_PROOFING_COMPLETE or IDENTITY_PROOFING_FAILED event

[ ] Update overlay/gates/ finalization gate
      - block finalization if identity.verificationLevel < required threshold
      - threshold configurable per jurisdiction policy rule

[ ] Add identity result to evidence bundle
      - redact/hash PII before writing to bundle
      - include vendorSessionId, timestamp, verificationLevel, liveness, riskScore

[ ] Add IDENTITY_PROVIDER to overlay/config/ validation schema
      - fail-closed if provider is configured but credentials are absent

[ ] Update .env.example with identity provider variables
```

---

## Evidence Bundle Integration

Identity results must be separated from AI advisory output in the evidence bundle. The bundle should record:

- `identity-proofing.json` — redacted identity output, verification level, vendor session reference
- Reference in `authority-execution.json` — confirmation that identity was verified before finalization
- Reference in `hashes.json` — hash of the identity proofing record for tamper-evidence

This separation matters for MISMO certification reviews, which evaluate identity verification as a distinct category from AI or document analysis.

---

## MISMO Alignment

MISMO's RON standards review identity verification as a first-class category. The integration must produce:

- A record of which IDV standard was applied (e.g. NIST IAL2)
- A timestamp and session reference for the verification event
- Evidence that liveness was confirmed
- Evidence that the KBA or document check was completed

This evidence chain is what turns a "we integrated an IDV vendor" claim into something a title/mortgage buyer can audit.

---

## Next Steps

1. Choose initial vendor (Persona recommended for API-first composability)
2. Implement `overlay/services/identityService.js` with the Persona adapter
3. Wire into `CompliantActOrchestrator`
4. Add identity records to evidence bundle
5. Update policy rules to require `verificationLevel >= IAL2` for applicable jurisdictions
6. Test the full compliant flow end-to-end with a mocked Persona response
