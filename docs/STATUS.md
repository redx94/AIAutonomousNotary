# What Is Real / What Is Mocked / What Is Next

> **Purpose:** A single honest reference page for partners, investors, and technical reviewers. Do not send anyone to pitch materials before they have read this page. Last updated: April 2026.

---

## The Honest Summary

AI Autonomous Notary has a real, tested technical foundation — a Solidity protocol core with 143 passing tests and a Compliance Overlay that implements a human-supervised, policy-enforced authority flow for remote online notarization. It does **not** yet have: a production identity proofing integration, a recording infrastructure, an external security audit, a live pilot, or revenue.

The demo UI is real code running against a designed state model. The case data and service calls within it are mocked.

---

## ✅ What Is Real (Built and Tested)

| Component | What It Does | Where to Look |
|-----------|-------------|---------------|
| **Solidity contract core** | 10 contracts covering notarization, registry, access control, fractionalization, oracle validation, and emergency controls | `contracts/` |
| **143 passing tests** | Full unit test suite at ~80% coverage | `npx hardhat test` |
| **Compliance Overlay** | Human-supervised authority flow: intake → AI advisory → identity → policy evaluation → human review → ceremony → finalization → evidence bundle → optional publication | `overlay/` |
| **Policy engine** | Jurisdiction-configurable rule engine that enforces requirements and fails closed on incomplete execution | `overlay/policy/` |
| **Finalization gate** | Blocks act completion if policy, ceremony, human signoff, or evidence requirements are not met | `overlay/gates/` |
| **Evidence bundle spine** | Structured, hashable records for each step: AI output, policy decision, human review, authority execution, publication result | `overlay/evidence/` |
| **Fail-closed configuration** | `LEGAL_MODE=compliant` by default; autonomous execution requires explicit opt-in override | `overlay/config/` |
| **Interactive demo UI** | Four-role workflow demo (Signer, Notary, Compliance, Verifier) — live at [redx94.github.io/AIAutonomousNotary](https://redx94.github.io/AIAutonomousNotary/) | `web/` |
| **Sepolia testnet deployment** | Deployment scripts exist and work | `scripts/deploy*.js` |
| **Compliance validation CLI** | `npm run compliance:validate` and `npm run test:compliance` | `package.json` |

---

## 🟡 What Is Partially Real (Designed, Not Yet Wired)

| Component | What Is Real | What Is Mocked or Missing |
|-----------|-------------|--------------------------|
| **AI risk scoring** | The overlay calls an AI analysis step; the advisory output is displayed to the human reviewer and labeled as non-authoritative throughout | No external AI analysis provider is wired. Demo uses static mock scores. |
| **Identity proofing** | The overlay has an identity proofing step in the compliant flow; the integration interface is specified in [`docs/integrations/identity-verification.md`](integrations/identity-verification.md) | No external IDV vendor (Persona, Socure, AU10TIX) is wired. Demo uses static mock identity results. |
| **Ceremony recording** | The ceremony step produces an artifact in the evidence bundle | No recording infrastructure (video, audio) is wired. Demo simulates ceremony completion. |
| **On-chain publication** | Sepolia deployment scripts exist; `overlay/services/` has a protocol publication adapter | Not mainnet. Publication in demo is simulated. |
| **ERC-3643 security token** | `DocumentSecurityToken.sol` is implemented and tested | KYC waitlist is contract-level only; no live KYC/AML data provider is wired. |

---

## ❌ What Is Not Built Yet

| Component | Status | Notes |
|-----------|--------|-------|
| **External security audit** | Not started | Planned before any production use or institutional pilot |
| **Production IDV vendor integration** | Not started | Integration path specified in `docs/integrations/identity-verification.md` |
| **Recording/ceremony infrastructure** | Not started | Required for MISMO RON compliance |
| **Mainnet deployment** | Not started | Requires audit + production IDV + pilot validation first |
| **Live marketplace or trading** | Not started | Phase 2 expansion; tokenization contracts exist but no market is running |
| **Production pilots or revenue** | Not started | Actively seeking first design partner |
| **MISMO certification** | Not started | Process not yet initiated; gap analysis in `docs/wedge/real-estate-title.md` |
| **Customer-facing production application** | Not started | The demo UI is a functional prototype over mocked data, not a production system |

---

## 🔵 What the Demo Shows vs. What It Uses

The demo at [redx94.github.io/AIAutonomousNotary](https://redx94.github.io/AIAutonomousNotary/) is a real React application. Here is a precise breakdown of what each layer reflects:

| Demo Element | Real or Mocked | Detail |
|-------------|---------------|--------|
| **Navigation and routing** | Real | Hash-based React Router, four distinct role workflows |
| **State machine (CaseState values)** | Real | States like `FINALIZED_OFFCHAIN`, `PUBLISHED`, `REFUSED` map to actual overlay event types |
| **Policy structure** | Real | Policy decisions and fail-closed logic reflect actual `overlay/policy/` rules |
| **Authority flow steps** | Real | The sequence (intake → AI → identity → policy → review → ceremony → finalize → bundle) maps to `CompliantActOrchestrator` |
| **Authority boundary** | Real | AI is visually labeled as advisory; notary action is the legally operative step |
| **Case data (documents, signers, etc.)** | Mocked | Static mock cases in `web/src/data/mockCases.ts` |
| **AI risk scores** | Mocked | Static values; no external provider called |
| **Identity verification results** | Mocked | Static mock results; no external IDV vendor called |
| **Evidence bundle contents** | Mocked | Displayed structure matches spec; data is static |
| **On-chain publication** | Simulated | No real transaction occurs in the demo |

---

## ➡️ What Is Next (In Priority Order)

| # | Work Item | Why It Matters |
|---|-----------|---------------|
| 1 | Wire a production IDV vendor (Persona recommended) | Required for any real pilot; required for MISMO review |
| 2 | Add ceremony recording infrastructure stub | Required for RON legal compliance in most states |
| 3 | Add real-estate/title jurisdiction rules to policy engine | Makes the overlay deployable in the eClosing beachhead |
| 4 | One design-partner pilot (RON operator or title/closing platform) | Converts architecture proof into market proof |
| 5 | External security audit | Required before institutional use; required for any serious acquisition conversation |
| 6 | MISMO certification path inquiry | Legitimacy gate for mortgage/title buyers |
| 7 | Mainnet deployment | Follows audit + pilot validation |
| 8 | Production customer-facing application | Follows design partner feedback |

See [`docs/integrations/identity-verification.md`](integrations/identity-verification.md) for the IDV integration plan and [`docs/wedge/real-estate-title.md`](wedge/real-estate-title.md) for the initial go-to-market focus.

---

## One-Line Version

> **The architecture and compliance overlay are real and tested. The demo UI shows the right flows over mocked data. Identity verification, recording, and production pilots are the three gaps that must close before this is a deployable product.**

