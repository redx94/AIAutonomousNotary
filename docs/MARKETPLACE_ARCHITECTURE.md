# AI Autonomous Notary — Document Securities Marketplace Architecture

## Overview

This document specifies the architecture for the **Document Securities Marketplace** — the Phase 2 trading layer that sits atop the Phase 1 infrastructure to enable secondary market liquidity for notarized document assets, fractional ownership shares, and document-backed financial products.

---

## NFT Collection Model (Corrected — Phase 1.5)

A finalized notarization session produces a **session-unique NFT collection** composed of:

| Token | Contract | Role |
|-------|----------|------|
| Master Notary Asset NFT | `NotaryNFT.sol` | Root legal / economic / collectible token. Fractionalization target. |
| Page / Component NFTs | `DocumentPageNFT.sol` | Provenance + collectible sub-assets per page. NOT fractionalized. |
| Collection Manifest | `DocumentCollectionRegistry.sol` | On-chain relationship registry tying master + pages together. |

**Key invariants:**
- One session → one collection → one master NFT → N page NFTs
- Fractionalization (via `FractionalizationVault`) targets **only** the master NotaryNFT
- Page NFTs are provenance/collectible artifacts — never direct economic instruments
- NFT minting occurs **after** off-chain legal finalization; mint failure does not affect the legal record
- All visual seeds are derived deterministically on-chain; sensitive document content is never stored publicly in token metadata

**Finalization → Assetization flow:**
```
Legal finalization (off-chain)
→ Evidence bundle
→ Collection registration (DocumentCollectionRegistry)
→ Master NFT mint (NotaryNFT)
→ Page NFT mints (DocumentPageNFT, optional)
→ Collection manifest finalized
→ Optional protocol publication
→ User sees Digital Asset Collection in UI
```

---

## Marketplace Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Structured Products (Phase 3)                      │
│  Indices, CDOs, derivatives, cross-chain bridges             │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Document Securities Marketplace (Phase 2)          │
│  AMM, order book, lending, DAO governance                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Infrastructure (Phase 1 ✅ Complete)               │
│  Registry, NFT, Fractionalization, AI Oracle, Compliance     │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Marketplace Components

### 1. NotaryNFT Order Book (`DocumentNFTMarket.sol`)

A non-custodial peer-to-peer marketplace for whole `NotaryNFT` seals (unfractionalized documents).

**Design Pattern**: ERC-721 listing with fixed-price and Dutch auction support.

```solidity
// contracts/DocumentNFTMarket.sol — Phase 2
contract DocumentNFTMarket is AccessControl, ReentrancyGuard, Pausable {
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;          // in ETH or NOTARY token
        address payToken;       // ETH = address(0), NOTARY = token address
        uint256 expiresAt;      // 0 = no expiry
        bool    dutchAuction;
        uint256 startPrice;     // Dutch auction start price
        uint256 endPrice;       // Dutch auction floor
        uint256 auctionEnd;
    }
    
    // Platform fee: 2.5% (250 basis points), paid to treasury
    // Royalty: enforced via ERC-2981 (automatically paid to seal creator)
    uint256 public constant PLATFORM_FEE_BP = 250;
    
    function listNFT(uint256 tokenId, uint256 price, address payToken, uint256 duration) external;
    function buyNFT(uint256 tokenId) external payable;
    function makeOffer(uint256 tokenId, uint256 offer, uint256 expiresAt) external payable;
    function acceptOffer(uint256 tokenId, address offerer) external;
    function cancelListing(uint256 tokenId) external;
}
```

**Fee Flow on Each Sale:**
```
Sale Price: 100 ETH
├── ERC-2981 royalty (e.g. 5%): 5 ETH → Original seal creator
├── Platform fee (2.5%): 2.5 ETH → Treasury → NOTARY buy-and-burn (60%) + rewards (40%)
└── Seller proceeds: 92.5 ETH → Seller
```

---

### 2. Fractional Share AMM (`FractionAMM.sol`)

A Uniswap v2-style constant product AMM for trading `FractionalizationVault` ERC-20 share tokens. Each vault's fractions become a tradeable pair against ETH or USDC.

**Why AMM over order book for fractions?**
- Fractions are fungible ERC-20s → AMM is far more gas-efficient
- Deep liquidity possible even for small documents via LP incentives
- 24/7 price discovery without matching

```solidity
// contracts/FractionAMM.sol — Phase 2
contract FractionAMM is AccessControl, ReentrancyGuard {
    // Standard x*y=k invariant
    // Fee: 0.3% per swap (standard Uniswap v2 rate)
    // Protocol takes 0.05% of the 0.3% fee (Uniswap v2 protocol fee model)
    
    struct Pool {
        address fractionToken;   // FractionalizationVault ERC-20
        address quoteToken;      // ETH (address(0)) or USDC
        uint256 reserveFraction;
        uint256 reserveQuote;
        uint256 totalLPShares;
        uint256 createdAt;
        bool    verified;        // Admin-verified pool (prevents fake vault pools)
    }
    
    mapping(address => Pool) public pools;  // fractionToken -> Pool
    
    function createPool(address fractionToken, address quoteToken, uint256 initialFraction, uint256 initialQuote) external;
    function addLiquidity(address fractionToken, uint256 fractionAmount, uint256 quoteAmount) external returns (uint256 lpShares);
    function removeLiquidity(address fractionToken, uint256 lpShares) external returns (uint256, uint256);
    function swap(address fractionToken, address tokenIn, uint256 amountIn, uint256 minOut) external returns (uint256);
    function getSpotPrice(address fractionToken) external view returns (uint256);
}
```

**Pool Verification Flow:**
1. Vault creator deploys `FractionalizationVault` 
2. Submits pool creation request with NFT backing proof
3. `AIEngine` validates the underlying `NotaryNFT` is authentic
4. Admin marks pool as `verified = true`
5. Verified pools are listed in official marketplace UI

---

### 3. Document-Backed Lending (`DocumentLending.sol`)

Fractional document shares as collateral for USDC loans — enabling yield without selling.

```solidity
// contracts/DocumentLending.sol — Phase 2
contract DocumentLending is AccessControl, ReentrancyGuard, Pausable {
    // Inspired by Compound/AAVE architecture
    // Collateral: FractionalizationVault ERC-20 shares
    // Borrow: USDC (hardcoded for regulatory simplicity in Phase 2)
    
    struct Position {
        address collateralToken;   // Fraction token address
        uint256 collateralAmount;  // Fraction tokens locked
        uint256 borrowedAmount;    // USDC borrowed
        uint256 interestAccrued;
        uint256 health;            // Collateral ratio (scaled by 1e18)
        uint256 openedAt;
    }
    
    // Conservative LTV: 50% (document values less liquid than ETH)
    uint256 public constant MAX_LTV_BP = 5000;    // 50%
    uint256 public constant LIQ_THRESHOLD = 6500; // Liquidate at 65% LTV
    uint256 public constant BASE_RATE_APR = 800;  // 8% base borrowing rate
    
    // Oracle pricing: OracleManager.getDocumentValuation() → fraction price
    IOracleManager public oracleManager;
    
    function openPosition(address collateralToken, uint256 collateralAmount, uint256 borrowAmount) external;
    function repay(uint256 positionId, uint256 amount) external;
    function addCollateral(uint256 positionId, uint256 amount) external;
    function liquidate(uint256 positionId) external;  // callable by anyone when health < threshold
    function getHealthFactor(uint256 positionId) external view returns (uint256);
}
```

**Risk Controls:**
- Liquidation bots incentivized with 5% liquidation bonus
- Max borrow per user: $500K equivalent (Phase 2 limit)
- Insurance fund seeded from 10% of lending fees

---

### 4. Insurance Fund (`InsuranceFund.sol`)

Systemic risk mitigation — protects against oracle failures, smart contract bugs, and document fraud losses.

```solidity
// contracts/InsuranceFund.sol — Phase 2
contract InsuranceFund is AccessControl, ReentrancyGuard {
    // Funded by:
    //   10% of all platform fees from NFT market
    //   10% of lending protocol fees
    //   Direct NOTARY/ETH DAO contributions
    
    // Claims triggered by:
    //   EmergencyProtocol Level 2/3 events
    //   Validated oracle manipulation events
    //   Court-ordered document reversal
    
    function depositFunds() external payable;
    function submitClaim(uint256 affectedDocId, uint256 amount, string calldata evidence) external;
    function approveClaim(uint256 claimId) external onlyRole(CLAIMS_ADMIN);
    function rejectClaim(uint256 claimId, string calldata reason) external onlyRole(CLAIMS_ADMIN);
    function getTotalCoverage() external view returns (uint256);
}
```

---

## Marketplace Pricing Infrastructure

### Price Oracle Architecture

Document valuations feed into both the AMM and lending protocol:

```
OracleManager.sol (Phase 1 ✅)
    ↓
getDocumentValuation(documentHash) → uint256 valueWei
    ↓
┌──────────────────────────────────────────┐
│     Valuation Sources (aggregated)       │
│  • Recent sale prices (from NFTMarket)   │
│  • Comparable document analysis (AI)     │
│  • IPFS metadata hash verification       │
│  • Jurisdiction-adjusted multipliers     │
└──────────────────────────────────────────┘
    ↓
FractionAMM.getSpotPrice() — per-share price
DocumentLending.getHealthFactor() — collateral ratio
```

---

## Compliance Layer

The marketplace inherits the Phase 1 compliance infrastructure and adds:

### Transfer Restrictions
- All `DocumentSecurityToken` trades require accredited investor verification (existing in Phase 1)
- Geographic restrictions enforced via IP-layer attestation + on-chain flag in `DocumentSecurityToken`
- Trades above **$1M equivalent** require 24-hour cooling period (anti-manipulation)

### Regulatory Reporting
- All trades emit events captured by a compliance reporting oracle
- Quarterly reports auto-generated for SEC Regulation CF / Regulation D filings
- Emergency freeze of specific tokens via `EmergencyProtocol.sol` (Phase 1 ✅)

---

## Smart Contract Dependency Graph

```
Phase 1 (existing):
  DocumentRegistry → NotaryNFT → FractionalizationVault → DocumentSecurityToken
  AIEngine → OracleManager → ValidationOracle

Phase 2 (new):
  DocumentNFTMarket → NotaryNFT (read only)
  FractionAMM → FractionalizationVault (ERC-20 interface)
  DocumentLending → FractionAMM + OracleManager
  InsuranceFund → EmergencyProtocol (triggered by L2/L3 events)
  NotaryGovernor → All contracts (upgrade path via timelock)
  DIDRegistry → DocumentRegistry + NotaryNFT
```

---

## Gas Optimization Strategy

| Operation | Strategy |
|---|---|
| NFT listings | Lazy minting pattern — listing signature stored off-chain until purchase |
| AMM swaps | Uniswap v2 codebase (battle-tested, optimized assembly) |
| Fraction transfers | ERC-20 standard (low gas baseline) |
| Compliance checks | View-only pre-check off-chain; reject reverts on-chain |
| Oracle price reads | Caching in `OracleManager` (Phase 1 ✅) reduces redundant Chainlink calls |

---

## Revenue Model (Phase 2)

| Revenue Stream | Rate | Distribution |
|---|---|---|
| NFT sale fee | 2.5% | 60% burn, 40% treasury |
| AMM swap fee | 0.05% protocol cut | 50% stakers, 50% treasury |
| Lending origination fee | 0.5% of loan | 50% insurance fund, 50% stakers |
| Lending interest spread | 2% (over cost of capital) | 40% burn, 60% treasury |
| Vault creation fee | 0.1 ETH flat | 100% treasury |

---

## Phase 2 Sprint Plan

| Sprint | Deliverable | Priority |
|---|---|---|
| 1 | `DIDRegistry.sol` + `NotaryToken.sol` + `NotaryGovernor.sol` | High |
| 2 | `DocumentNFTMarket.sol` (buy/sell/offers) | High |
| 3 | `FractionAMM.sol` (pool creation, swaps, LP) | High |
| 4 | `DocumentLending.sol` (borrow/repay/liquidate) | Medium |
| 5 | `InsuranceFund.sol` + claim workflow | Medium |
| 6 | Cross-chain bridge factory (Polygon first) | Low |
| 7 | Marketplace front-end integration | Full sprint |

---

> **Note**: All Phase 2 contracts must pass a formal security audit before mainnet deployment. The Phase 1 audit track should begin immediately (contracts are now feature-complete) so the Phase 2 audit can begin on a parallel track during Phase 2 development.
