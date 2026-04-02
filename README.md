<div align="center">
  <img src="docs/ainotary_nft_concept.png" alt="AI Autonomous Notary Logo" width="100%" />
</div>

# 🏛️ AI Autonomous Notary

**The Premier Decentralized Protocol for Document Securities & Cryptographic Notarization**

[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](./LICENSE)
[![Coverage](https://img.shields.io/badge/Coverage-79%25-brightgreen.svg)]()
[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.20-363636.svg)]()
[![Tests](https://img.shields.io/badge/Tests-143%20Passing-success.svg)]()

AI Autonomous Notary is a protocol that transforms traditional document notarization from a static, per-transaction service into a **dynamic, tradeable Web3 asset class**. By combining advanced Artificial Intelligence for fraud detection, zero-knowledge cryptographic proofs, and ERC-3643 compliant tokenization, the platform allows real-world documents (deeds, IP, agreements) to be securely notarized, fractionalized, and traded on a decentralized secondary market.

---

## 🌟 The "Living Cipher" / Cryptographic Mandala

We move beyond standard QR codes. When a document is notarized on our protocol, the AI generates a **Cryptographic Mandala** — a "Living Cipher."

The exact geometric intersections, colors, and wave frequencies of the NFT artwork are mathematically derived directly from the document's SHA-256 hash and the AI fraud score using steganography. While users see a stunning, unforgeable piece of digital art, our protocol scanner can "read" the geometry to instantly verify the document's authenticity.

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
- **`NotaryNFT.sol`**: The underlying ERC-721 contract minting the unique "Living Cipher" for every notarized document, enforcing ERC-2981 royalties.
- **`FractionalizationVault.sol`**: Allows any Document NFT to be vaulted and fractionalized into ERC-20 shares, enabling retail investment in high-value document assets with pro-rata yield distribution and a 48-hour buyout mechanism.

## 🧭 Compliance Overlay V2

The repository now includes a **Compliance Overlay** that sits around the existing protocol core instead of rewriting it. In `compliant` mode, legally operative notarization runs through an off-chain, human-supervised authority flow with policy enforcement, human ceremony, final signoff, and evidence bundle generation. The existing contracts remain intact as protocol primitives and optional publication rails for downstream proof, attestation, and anchoring.

This does **not** turn the project into a smaller human-only product. The autonomous/provider-oriented architecture is still present, explicit, and testable. What changes in compliant mode is the authority boundary:
- legal validity comes from the human-supervised off-chain flow
- protocol publication is downstream and non-authoritative for legal validity
- compliant mode fails closed if explicit review, ceremony artifact, policy, or evidence requirements are incomplete

See [`docs/architecture/compliance-overlay.md`](docs/architecture/compliance-overlay.md) and [`docs/usage/compliant-mode.md`](docs/usage/compliant-mode.md) for the operating model.

---

## 📈 Market Opportunity & Research

Traditional notarization is a $2.8B market constrained by physical boundaries and business hours. Blockchains and NFTs solve this completely, while unlocking a multi-trillion dollar document securities market.

| Metric | Projection / Data Point |
|--------|-------------------------|
| **Current TAM (2024)** | $2.8 Billion USD |
| **Projected TAM (2033)** | $12.6 Billion USD (17.5% CAGR) |
| **Cost Reduction** | 70-90% cheaper than traditional public notaries |
| **Time to Finality** | 210ms complete notarization vs. Days/Weeks |
| **Tokenized Debt Market**| SEC Framework projects `$1-3 Trillion` by 2030-2035 |

*See `docs/RESEARCH.md` for our full market analysis and academic sources.*

---

## 💼 Investor Relations

> **Not a developer? Start here.** Our dedicated investor documentation explains everything about this project in plain English — no technical background required.

### 📁 [→ Access the Investor Resource Center](./investors/README.md)

| Quick Stat | |
|---|---|
| **Raise Target** | $3.5M – $5.0M Seed Round |
| **Pre-Money Valuation** | $25M – $35M FDV |
| **Technology Status** | Phase 1 Complete — 143/143 tests passing |
| **5-Year Revenue Target** | $88.5M ARR |
| **Token Supply** | 100,000,000 $NOTARY (fixed, deflationary) |
| **Investor Allocation** | 15% of total token supply |

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

## 💻 Frontend Ecosystem & UI/UX

Our architecture includes a planned Next.js 14 Web3 portal designed for maximum Web2 accessibility.

<div align="center">
  <img src="docs/ainotary_dashboard_mockup.png" alt="DApp Dashboard Mockup" width="80%" />
</div>

The portal serves **four key user segments**:
1. **Document Owners**: Upload documents for instant AI pre-scanning and NFT seal issuance.
2. **Notaries**: Manage multi-party signing queues and earn secondary royalty fees.
3. **Fractional Investors**: Browse document-backed assets (real estate, IP), complete KYC, and purchase yield-bearing fractional shares.
4. **Verifiers**: 100% walletless public verification of any Living Cipher NFT.

*See `docs/FRONTEND_BLUEPRINT.md` for the complete tech stack, API routes, and design system.*

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

---

## 📄 License & Security

- 💰 **[Financial Valuation Model](docs/VALUATION_MODEL.md)** - 5-Year ARR projections, RWA market comps, and Seed round FDV justification for investors.

This project is licensed under the [BUSL-1.1 License](./LICENSE).

**Security Notice:** Phase 1 smart contracts have achieved `~80%` test coverage and incorporate rigorous OpenZeppelin access controls (`AccessControl`, `Pausable`, `ReentrancyGuard`). However, the protocol is actively under development and **has not yet undergone a formal external audit**. Do not use in production with real funds until Phase 3.

---
<div align="center">
  <i>Bringing the trust layer of the physical world onto the cryptographic frontier.</i>
</div>
