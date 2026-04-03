<div align="center">
  <img src="docs/ainotary_nft_concept.png" alt="AI Autonomous Notary Logo" width="100%" />
</div>

# 🏛️ AI Autonomous Notary

**Compliance-aware digital notarization infrastructure — cryptographic proofs, human-supervised authority, and optional on-chain publication.**

[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](./LICENSE)
[![Coverage](https://img.shields.io/badge/Coverage-79%25-brightgreen.svg)]()
[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.20-363636.svg)]()
[![Tests](https://img.shields.io/badge/Tests-143%20Passing-success.svg)]()
[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-View%20UI%2FUX-blueviolet?style=for-the-badge)](https://redx94.github.io/AIAutonomousNotary/)
[![Topics](https://img.shields.io/badge/topics-notarization%20%7C%20RON%20%7C%20compliance%20%7C%20solidity%20%7C%20regtech-informational)]()

<div align="center">

### 👉 [**Try the Live Interactive Demo →**](https://redx94.github.io/AIAutonomousNotary/)

*Explore the full Signer, Notary, and Compliance workflows — no wallet or sign-up required.*

</div>

---

AI Autonomous Notary is a protocol and compliance framework for legally-significant document notarization. It combines a tested Solidity contract core with a **Compliance Overlay** — a human-supervised, policy-enforced authority flow that makes compliant remote online notarization (RON) possible today, while preserving autonomous on-chain publication as a downstream step. Tokenization of document-backed assets is a natural expansion of the architecture, not the current beachhead.

The project targets **law firms, title and closing workflows, estate-planning providers, mortgage teams, and RON platform operators** who need cryptographic document trust that maps to real-world legal requirements — not a promise that blockchains replace notaries.

---

## ✅ What Exists Today

This is an early-stage technical foundation. The following table is honest about what is real, what is demonstrated, and what is planned.

| Area | Status | Notes |
|------|--------|-------|
| **Solidity contract core** | ✅ Implemented & tested | 143 passing tests, ~80% coverage |
| **Compliance Overlay** | ✅ Implemented | Human-supervised authority flow, policy engine, evidence bundle |
| **Interactive demo UI** | ✅ Live | Signer, Notary, Compliance, Verifier workflows — [try it](https://redx94.github.io/AIAutonomousNotary/) |
| **Compliance policy engine** | ✅ Implemented | Rule validation, fail-closed mode |
| **Emergency controls** | ✅ Implemented | Circuit breakers at Level 1 / Level 3 |
| **AI risk scoring** | 🟡 Demo/advisory | Advisory only; displayed to human reviewer, not authoritative |
| **Identity proofing** | 🟡 Mocked in demo | Flow is designed; integrations (e.g. Jumio, Persona) not wired |
| **On-chain publication** | 🟡 Testnet only | Sepolia deployment scripts exist; not mainnet |
| **Tokenization / marketplace** | 🔵 Architecture designed | Contracts exist; no live market or trading |
| **External security audit** | ❌ Not yet | Planned before production use |
| **Production pilots** | ❌ Not yet | Actively seeking first design partner (see below) |

> **The legal record lives in the off-chain evidence bundle.** On-chain publication is downstream and non-authoritative for legal validity. Mint failure does not invalidate the notarial act.

---

## 🧭 Why Compliance Is the Moat

Most teams building in this space fail in one of two ways: they build a shallow app with no protocol foundation, or they build a pure crypto architecture that breaks when legal reality arrives.

This project addresses both. The **Compliance Overlay** sits around the existing protocol core — it does not replace it. In `compliant` mode:

- Legal validity flows from a **human-supervised off-chain authority** (the notary), not from a smart contract
- The protocol core provides **cryptographic anchoring, evidence timestamping, and optional publication rails**
- The overlay **fails closed** — if policy, ceremony artifact, human signoff, or evidence requirements are incomplete, the act does not finalize
- AI findings are **advisory only**, clearly labeled as such throughout the UI and architecture

This maps directly to how state-by-state RON law actually works: 47 states + D.C. allow remote online notarization, each with process controls, identity requirements, and audio-visual mandates. "We understand the boring part" is the moat.

See [`docs/architecture/compliance-overlay.md`](docs/architecture/compliance-overlay.md) and [`docs/usage/compliant-mode.md`](docs/usage/compliant-mode.md) for the full operating model.

---

## 🏗️ Core Architecture (Phase 1 Complete)

The protocol is built on a robust, heavily-tested Solidity foundation (`143/143 passing tests, ~80% coverage`):

### 1. Identity & Compliance
- **`NotaryAccessControl.sol`**: Hybrid DAO governance with 48-hour timelocks and multi-sig administrative controls.
- **`DocumentSecurityToken.sol`**: ERC-3643 compliant security token enforcing KYC waitlists, accredited investor checks, and forced transfer recovery.
- **`ConditionalAccess.sol`**: Unlocking document decryption keys based on strict on-chain conditions (time-locks, multi-sig, oracle price triggers, or escrow payments).

### 2. Validation & Oracles
- **`ValidationOracle.sol`**: A decentralized network of AI nodes voting on document authenticity, with reputation slashing for malicious actors.
- **`OracleManager.sol`**: Chainlink-compatible price feeds providing real-time USD valuations for document-backed assets (e.g., real estate deeds).
- **`EmergencyProtocol.sol`**: Automated circuit breakers that halt the protocol at Level 1 (suspected fraud) or Level 3 (critical exploits).

### 3. Tokenization & Market Infrastructure
- **`NotaryNFT.sol`**: The master ERC-721 contract minting the unique "Living Cipher" for every finalized notarization session. Serves as the root legal/protocol/economic token. Eligible for fractionalization.
- **`DocumentPageNFT.sol`** *(new)*: Child ERC-721 contract minting per-page provenance and collectible tokens. Each token is cryptographically linked to a master NotaryNFT and a `DocumentCollectionRegistry` entry. Page tokens are NOT eligible for fractionalization.
- **`DocumentCollectionRegistry.sol`** *(new)*: On-chain manifest and relationship registry. Records the full composition of each session's NFT collection — master token, page tokens, document set root hash, manifest hash/CID, art seed, and mint lifecycle status. One collection per finalized session.
- **`FractionalizationVault.sol`**: Locks a **master** NotaryNFT and issues fungible ERC-20 fraction tokens representing proportional economic ownership. Fractionalization targets the master token only, not arbitrary page NFTs.

#### NFT Collection Model

Each finalized notarization session produces:

```
Session / Case
└── NFT Collection (DocumentCollectionRegistry entry)
    ├── Master Notary Asset NFT (NotaryNFT token)
    │   • Root legal / economic / collectible token
    │   • Unique Living Cipher master artwork
    │   • Fractionalization eligible
    │   • Cryptographic identity of the document set
    └── Page / Component NFTs (DocumentPageNFT tokens, one per page)
        • Provenance + collectible sub-assets
        • Visually related to master (same collection seed)
        • Cryptographically bound to master via collectionId + masterTokenId
        • NOT fractionalization eligible
```

**Visual generation:** All artwork is derived deterministically from artSeeds generated on-chain. The master artSeed comes from `keccak256(collectionId, sessionId, rootHash)`. Page artSeeds come from `keccak256(collectionId, pageIndex, pageHash)`. The off-chain renderer (Living Cipher SVG engine) uses these seeds to produce coherent, unique "Cryptographic Mandala" visuals without storing sensitive document content publicly.

**NFT minting is strictly downstream of off-chain legal finalization:**
1. Legal finalization → 2. Evidence bundle → 3. Collection registration → 4. Master NFT mint → 5. Page NFT mints → 6. Collection manifest finalized → 7. Optional protocol publication

Mint failure does NOT invalidate the legal record.

## 🤝 Pilot & Design Partner Program

The biggest gap between this repo and an investable product is not the code — it's one real design partner willing to say: *"yes, we want this solved."*

If you operate in **legal document workflows, title and closing, estate planning, mortgage, or remote online notarization**, and you're looking for cryptographic document trust infrastructure that respects your compliance obligations — we want to talk.

**Target design partner personas:**
- RON platform operators (Proof, BlueNotary, NotaryCam, Stavvy, Pavaso)
- Title and closing workflow vendors (Qualia, Pavaso)
- E-signature platforms exploring compliance-grade notarization extensions
- Law firms or estate planning shops that need defensible digital document audit trails
- Lenders running mortgage/closing workflows with multi-state RON requirements

**📬 Contact:** Open a [GitHub Discussion](https://github.com/redx94/AIAutonomousNotary/discussions) or file an issue tagged `design-partner` to start a conversation.

---

## 📈 Market Context

47 states + D.C. now have laws permitting remote online notarization (NASS, 2024). Tokenized real-world assets have grown to roughly $28B in market capitalization (BCG). The combination of compliance-aware notarization infrastructure and on-chain document anchoring sits inside two real, growing trends.

| Metric | Data Point |
|--------|-----------|
| **RON-enabled jurisdictions** | 47 states + D.C. (NASS 2024) |
| **Traditional notarization TAM** | $2.8B (2024) → $12.6B projected (2033, 17.5% CAGR) |
| **Tokenized RWA market cap** | ~$28B (BCG, 2024) |
| **Cost reduction potential** | 70–90% vs. in-person notarization |

*See `docs/RESEARCH.md` for full market analysis and sources.*

---

## 💼 Investor Relations

> **Not a developer?** Our investor documentation explains the project in plain English — no technical background required.

### 📁 [→ Access the Investor Resource Center](./investors/README.md)

The investor docs include current-state framing, what is and is not being claimed about maturity, the compliance operating model, and the next de-risking milestones. They are intentionally more conservative than the architecture vision — read them in that spirit.

### Investor Documents

| Document | What It Covers |
|----------|----------------|
| [📋 Executive Summary](./investors/01_EXECUTIVE_SUMMARY.md) | What we do and why it matters — start here |
| [🔍 The Problem & Solution](./investors/02_THE_PROBLEM_AND_SOLUTION.md) | The broken system we're replacing |
| [📖 How It Works](./investors/03_HOW_IT_WORKS.md) | Simple, step-by-step platform walkthrough |
| [📊 Market Opportunity](./investors/04_MARKET_OPPORTUNITY.md) | $12.6B notary market + $3T RWA opportunity |
| [💰 Business Model](./investors/05_BUSINESS_MODEL.md) | Three automated revenue streams explained |
| [📈 Financial Projections](./investors/06_FINANCIAL_PROJECTIONS.md) | 5-year forecast with assumptions explained plainly |
| [🪙 Token & Investment Terms](./investors/07_TOKEN_AND_INVESTMENT.md) | What you receive as an investor |
| [🗺️ Roadmap](./investors/08_ROADMAP.md) | Build plan and milestones in plain English |
| [🏆 Competitive Advantage](./investors/09_COMPETITIVE_ADVANTAGE.md) | Why we win against DocuSign, Centrifuge & others |
| [🔐 Team, IP & Legal](./investors/10_TEAM_AND_IP.md) | Code protection, security architecture, FAQs |

*For deeper technical context, see the [`docs/VALUATION_MODEL.md`](./docs/VALUATION_MODEL.md) and [`docs/TOKENOMICS.md`](./docs/TOKENOMICS.md).*

---

## 🌟 The "Living Cipher" / Cryptographic Mandala

When a document is notarized and published on-chain, the protocol generates a **Cryptographic Mandala** — a "Living Cipher." The geometric intersections, colors, and wave frequencies of the NFT artwork are derived deterministically from the document's SHA-256 hash and session data. The off-chain renderer can "read" the geometry to instantly verify document authenticity without exposing document content.

---

## 💻 Live Demo UI

The interactive demo is live at **[redx94.github.io/AIAutonomousNotary](https://redx94.github.io/AIAutonomousNotary/)** — no wallet or sign-up required.

<div align="center">
  <img src="docs/ainotary_dashboard_mockup.png" alt="DApp Dashboard Mockup" width="80%" />
</div>

The demo covers four role-based workflows:
1. **Signer**: Document upload, AI advisory review, identity proofing, live session, final package
2. **Notary**: Queue management, case review, human decision (approve / refuse)
3. **Compliance**: Case ledger, evidence audit trail, publication status
4. **Verifier**: Walletless public verification portal

**What's mocked in the demo:** case data, AI scores, identity verification results, and the service layer. **What maps to real code:** the state model, event types, policy structure, and authority flow all reflect the actual overlay implementation.

*See `docs/FRONTEND_BLUEPRINT.md` for the complete tech stack and `web/README.md` for the architecture alignment notes.*

---

## 🚀 Quick Start (Developers)

### Prerequisites
- Node.js 18+
- npm or yarn
- Hardhat

### Installation & Testing
```bash
# 1. Clone the repository
git clone https://github.com/redx94/AIAutonomousNotary.git
cd AIAutonomousNotary

# 2. Install dependencies (OpenZeppelin 4.9.6, Hardhat, Ethers v6)
npm install

# 3. Run the complete 143-test suite
npx hardhat test

# 4. Generate the coverage report
npx hardhat coverage

# 5. Validate overlay policy configuration
npm run compliance:validate

# 6. Run the compliant overlay test suite
npm run test:compliance
```

### Deployment (Sepolia Testnet)
1. Copy `.env.example` to `.env`
2. Add your `PRIVATE_KEY` and `SEPOLIA_RPC_URL` (Alchemy/Infura)
3. Run the deployment script:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## 📚 Documentation Directory

Explore the full protocol blueprint and Phase 2 architecture:

- 📊 **[Tokenomics (NOTARY)](docs/TOKENOMICS.md)** - 100M supply, distribution, and the 5 utility pillars.
- 🏪 **[Marketplace Architecture](docs/MARKETPLACE_ARCHITECTURE.md)** - Fractional AMMs, document-backed lending, and order books.
- 🌐 **[DID Interface](docs/DID_INTERFACE.md)** - W3C Decentralized Identity integration for KYC/AML.
- 🎨 **[Frontend Blueprint](docs/FRONTEND_BLUEPRINT.md)** - End-user DApp architecture and features.
- 📜 **[Development Roadmap](docs/ROADMAP.md)** - The 5-Phase, 48-month master plan to mainnet.
- 🧭 **[Compliance Overlay Architecture](docs/architecture/compliance-overlay.md)** - Additive legal-operability shell around the protocol core.
- 🧱 **[Core vs Overlay Boundary](docs/architecture/core-vs-overlay-boundary.md)** - Where compliance logic lives and where it explicitly does not.
- 🏠 **[Real Estate / Title Wedge](docs/wedge/real-estate-title.md)** - Initial go-to-market focus: eClosing, MISMO alignment, and target buyer personas.
- 🪪 **[Identity Verification Integration](docs/integrations/identity-verification.md)** - IDV integration path (Persona, Socure, AU10TIX) and overlay hookup plan.

---

## 📄 License & Security

- 💰 **[Financial Valuation Model](docs/VALUATION_MODEL.md)** - 5-Year ARR projections, RWA market comps, and Seed round FDV justification for investors.

This project is licensed under the [BUSL-1.1 License](./LICENSE).

**Security Notice:** Phase 1 smart contracts have achieved `~80%` test coverage and incorporate rigorous OpenZeppelin access controls (`AccessControl`, `Pausable`, `ReentrancyGuard`). However, the protocol is actively under development and **has not yet undergone a formal external audit**. Do not use in production with real funds until Phase 3.

---

<div align="center">
  <i>Compliance-aware notarization infrastructure for legally significant documents.</i><br/><br/>
  <sub>Topics: notarization · remote-online-notarization · RON · compliance · regtech · solidity · ERC-3643 · document-security · cryptography · smart-contracts · legal-tech · e-sign · identity</sub>
</div>
