# AI Autonomous Notary — Governance Token Tokenomics

## Overview

The **NOTARY** governance token is the economic backbone of the AI Autonomous Notary Protocol. It aligns incentives across notaries, oracle operators, investors, and the protocol itself — enabling decentralized governance while sustaining platform operations.

---

## Token Specifications

| Parameter | Value |
|---|---|
| **Name** | Notary Protocol Token |
| **Symbol** | `NOTARY` |
| **Standard** | ERC-20 (with ERC-20 Votes extension for on-chain governance) |
| **Total Supply** | **100,000,000 NOTARY** (100M, fixed — no inflation) |
| **Decimals** | 18 |
| **Network** | Ethereum Mainnet (bridged to Polygon for low-cost operations) |

---

## Supply Distribution

```
100,000,000 NOTARY Total Supply
│
├── 30% — Ecosystem & Community Treasury (30,000,000)
│     Controlled by DAO governance after launch
│     Used for: grants, integrations, liquidity incentives
│
├── 20% — Team & Contributors (20,000,000)
│     4-year vesting, 1-year cliff
│     Released monthly after cliff
│
├── 18% — Protocol Revenue Staking Rewards (18,000,000)
│     Distributed to stakers over 5 years (decreasing schedule)
│     Year 1: 6M | Year 2: 5M | Year 3: 4M | Year 4: 2M | Year 5: 1M
│
├── 15% — Strategic Investors / Series A (15,000,000)
│     18-month vesting, 6-month cliff
│
├── 10% — Oracle Node Operators (10,000,000)
│     Vested over 3 years based on uptime/accuracy performance
│     Released quarterly via OracleManager performance oracle
│
├──  5% — Advisors & Partners (5,000,000)
│     2-year vesting, 6-month cliff
│
└──  2% — Initial Liquidity Bootstrap (2,000,000)
      Seeded to Uniswap v3 ETH/NOTARY pool at launch
      Protocol-owned liquidity (not sold)
```

---

## Vesting Schedule Summary

| Allocation | Amount | Cliff | Vesting |
|---|---|---|---|
| Team | 20M | 12 months | 48 months linear |
| Strategic Investors | 15M | 6 months | 18 months linear |
| Advisors | 5M | 6 months | 24 months linear |
| Oracle Operators | 10M | 0 | 36 months performance-based |
| Staking Rewards | 18M | 0 | 60 months decreasing |
| Treasury | 30M | 0 | DAO-controlled |
| Liquidity | 2M | 0 | Immediate |

---

## Token Utility

### 1. Platform Fee Payment
All notarization fees on the protocol can be paid in `NOTARY` at a **20% discount** versus ETH payment. Fee revenue is split:
- 60% → Buy-and-burn (deflationary pressure)
- 30% → Staking rewards pool
- 10% → Treasury

### 2. Governance Voting
One `NOTARY` = one vote. Token holders vote on:
- Protocol parameter changes (fee rates, consensus thresholds, oracle requirements)
- Treasury spend proposals
- Smart contract upgrades via timelock
- New jurisdiction approvals

**Quorum**: 4% of circulating supply (`≥4M` votes on a 100M supply)
**Timelock**: 48-hour execution delay on all passed proposals

### 3. Oracle Node Staking
Oracle nodes must stake a minimum of **50,000 NOTARY** as economic collateral. Staked tokens are slashed (up to 100%) on provable malicious behavior as enforced by `ValidationOracle.sol`. Honest oracles earn:
- Base APR: 12% on staked amount
- Performance bonus: Up to 8% additional based on accuracy score

### 4. Fractional Document Investment
`NOTARY` holders get **priority access** and fee discounts when investing in `FractionalizationVault` shares. A minimum of **1,000 NOTARY** unlocks reduced platform fees on vault creation.

### 5. Accredited Investor Verification Staking
Users who stake **10,000 NOTARY** can access the accredited investor tier of `DocumentSecurityToken` transfers without third-party KYC re-verification (subject to regulatory per-jurisdiction analysis).

---

## Governance Structure

### Phase 1 (Current): Admin Multi-Sig
- 3-of-5 multi-sig via `NotaryAccessControl.sol`
- Emergency actions via `EmergencyProtocol.sol`

### Phase 2: Hybrid DAO
- On-chain proposals via OpenZeppelin Governor
- Off-chain signaling via Snapshot
- Multi-sig as safeguard veto during transition

### Phase 3: Full DAO
- Complete governance transition
- Multi-sig deprecated
- Protocol-owned liquidity managed by DAO treasury

---

## Token Economic Model

### Value Accrual Drivers
1. **Fee volume** → buy-and-burn creates deflationary pressure as usage grows
2. **Oracle staking demand** → each new oracle node requires 50K NOTARY locked
3. **Governance premium** → utility in protocol decisions creates holding incentive
4. **Document Securities Market growth** → as TVL in vaults grows, NOTARY demand grows proportionally

### Projected Staking APR (Year 1)
Assuming 30% of circulating supply staked (~30M NOTARY):
- Base staking reward: 6M NOTARY / year ÷ 30M staked = **20% APR**
- Fee revenue share component: variable (depends on notarization volume)

---

## Smart Contract Implementation (Phase 2)

```solidity
// To be implemented in Phase 2:
// contracts/NotaryToken.sol
//   - ERC20Votes (for governance snapshots)
//   - TimelockController integration
//   - Vesting schedule contracts per allocation
//   - Staking pool with performance oracle hook

// contracts/NotaryGovernor.sol
//   - OpenZeppelin Governor + GovernorTimelockControl
//   - Proposal threshold: 100,000 NOTARY
//   - Voting delay: 1 day
//   - Voting period: 7 days
//   - Quorum: 4% of total supply

// contracts/StakingPool.sol
//   - Stake NOTARY, earn rewards + fee share
//   - Slash hook from ValidationOracle
//   - Lock periods: 30/90/180/365 days (multiplier tiers)
```

---

> **Note for Phase 2 implementation**: The `NOTARY` ERC-20 token address should be passed into `NotaryAccessControl`, `ValidationOracle`, and `FractionalizationVault` constructors as an optional fee-payment alternative, enabling a clean upgrade path without redeploying core contracts.
