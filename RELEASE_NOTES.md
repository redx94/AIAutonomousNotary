# Release Notes — v0.1.0-alpha

> **Publishing instructions:** To create the corresponding GitHub release, go to the repository → Releases → Draft a new release → tag `v0.1.0-alpha` → use this file as the body. Mark it as a pre-release.

---

## AI Autonomous Notary v0.1.0-alpha

**Release type:** Pre-release / Alpha  
**Date:** April 2026  
**Status:** Architecture complete — not production-ready; no external audit; no live pilots

---

## What This Release Contains

This is the first tagged snapshot of the AI Autonomous Notary protocol architecture. It establishes a publicly citable reference point for the Phase 1 technical foundation.

### ✅ Compliance Overlay (compliant mode)

A human-supervised, policy-enforced authority flow around the protocol core:

- `overlay/orchestrators/CompliantActOrchestrator.js` — canonical compliant flow (intake → AI analysis → identity → policy → human review → ceremony → finalization → evidence bundle → optional publication)
- `overlay/policy/` — jurisdiction-configurable rule engine with fail-closed enforcement
- `overlay/gates/` — finalization gate that blocks incomplete compliant execution
- `overlay/evidence/` — structured evidence bundle spine (separate records for AI output, human review, ceremony, authority execution, and publication)
- `overlay/authority/` — human and autonomous authority providers behind a single interface
- `overlay/config/` — validated fail-closed runtime configuration

### ✅ Smart Contract Core (143/143 tests passing, ~80% coverage)

- `NotaryNFT.sol` — master ERC-721 for finalized notarization sessions ("Living Cipher")
- `DocumentPageNFT.sol` — per-page provenance NFTs linked to master token
- `DocumentCollectionRegistry.sol` — on-chain manifest registry for NFT collections
- `FractionalizationVault.sol` — ERC-20 fractionalization of master tokens
- `DocumentSecurityToken.sol` — ERC-3643 compliant security token with KYC/AML controls
- `NotaryAccessControl.sol` — hybrid DAO governance with 48-hour timelocks
- `ConditionalAccess.sol` — condition-gated document decryption key release
- `ValidationOracle.sol` — decentralized AI node voting on document authenticity
- `OracleManager.sol` — Chainlink-compatible price feeds
- `EmergencyProtocol.sol` — automated circuit breakers (Level 1 / Level 3)

### ✅ Interactive Demo UI

Live at: **[redx94.github.io/AIAutonomousNotary](https://redx94.github.io/AIAutonomousNotary/)**

- Signer workflow: document upload, AI advisory findings, identity proofing, live session, final package
- Notary console: queue management, case review, approve / refuse decision
- Compliance ledger: case audit trail, evidence inspection, publication status
- Verification portal: walletless public verification

**Note:** The demo uses mocked case data and mocked identity/AI results. The state model, event types, policy structure, and authority flow all reflect the actual overlay implementation.

### ✅ Deployment Infrastructure

- Sepolia testnet deployment scripts (`scripts/deploy.js` through `scripts/deploy-phase5.js`)
- Compliance validation script (`npm run compliance:validate`)
- Compliance overlay test suite (`npm run test:compliance`)

---

## What Is Not In This Release

The following are explicitly out of scope for v0.1.0-alpha:

- Production identity proofing integration (Persona/Socure/AU10TIX not yet wired — see `docs/integrations/identity-verification.md`)
- Recording infrastructure for ceremony step
- Mainnet deployment
- External security audit
- Production pilots or revenue

---

## Relevant Documentation

- [What Exists Today](README.md#-what-exists-today) — honest status table
- [Why Compliance Is the Moat](README.md#-why-compliance-is-the-moat) — architecture rationale
- [IDV Integration Path](docs/integrations/identity-verification.md) — next integration milestone
- [Real Estate / Title Wedge](docs/wedge/real-estate-title.md) — initial go-to-market focus
- [Compliance Overlay Architecture](docs/architecture/compliance-overlay.md)
- [Investor Resource Center](investors/README.md)

---

## Quick Start

```bash
git clone https://github.com/redx94/AIAutonomousNotary.git
cd AIAutonomousNotary
npm install
npx hardhat test          # 143 tests
npm run compliance:validate
npm run test:compliance
```

---

## Security Notice

Phase 1 smart contracts have not yet undergone a formal external audit. Do not use in production with real funds. The compliance overlay is designed for testnet and pilot use only.
