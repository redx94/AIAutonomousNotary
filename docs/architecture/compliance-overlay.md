# Compliance Overlay

## Purpose
The compliance overlay provides a strict, removable execution shell around the AI Autonomous Notary protocol core. It keeps the current contracts intact while making compliant legal operation possible now.

## Authority Boundary
- In `compliant` mode, legal validity is produced by the off-chain human-supervised workflow.
- Contracts are downstream protocol publication rails only.
- A publication failure must not erase a valid off-chain authority record.

## Canonical Compliant Flow
1. Signer intake
2. Document intake
3. AI analysis
4. Identity proofing
5. Policy evaluation
6. Human review
7. Ceremony
8. Provider authorization or refusal
9. Finalization gate
10. Certificate completion
11. Final record signing
12. Evidence bundle generation
13. Optional protocol publication

## Overlay Modules
- `overlay/config`: validated fail-closed runtime configuration
- `overlay/policy`: data-driven jurisdiction policy engine
- `overlay/authority`: human and autonomous providers behind one interface
- `overlay/gates`: legal firewall that blocks incomplete compliant execution
- `overlay/orchestrators`: canonical compliant flow and shadow benchmarking
- `overlay/evidence`: auditable event and bundle spine
- `overlay/services`: protocol publication adapter/service

## Default Safety Posture
- `LEGAL_MODE=compliant`
- `AUTHORITY_PROVIDER=human_commissioned`
- autonomous execution disabled
- human ceremony and final signoff required
- jurisdiction policy enforcement required
- strict evidence mode enabled
