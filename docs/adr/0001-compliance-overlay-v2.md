# ADR 0001: Compliance Overlay V2

## Status
Accepted

## Context
The AI Autonomous Notary repository already contains a substantive protocol core: notarization NFTs, document registries, AI/oracle primitives, access control, circuit breakers, and tokenization infrastructure. That core should remain recognizable and future-facing.

Current legal-operability requirements, however, do not permit accidental autonomous finalization for legally operative notarization flows. The repository therefore needs a reversible shell that can enforce today's human-supervised authority constraints without poisoning the protocol core into a permanently diminished architecture.

## Decision
Add a root-level Compliance Overlay under `overlay/` that becomes the authoritative execution path for legally operative acts in `compliant` mode.

Key decisions:
- Legally operative authority is off-chain and human-supervised in compliant mode.
- The existing contracts remain protocol primitives, proof rails, attestation rails, and downstream publication targets.
- On-chain publication is optional, downstream, and non-authoritative for legal validity.
- Policy enforcement, human ceremony, final signoff, evidence generation, and fail-closed gating live in the overlay.
- The autonomous authority path remains implemented as a concrete provider, but is dormant in compliant mode and isolated to experimental/shadow use.

## Preserved
- The protocol vision around NFT-backed notarization, attestations, proofs, oracle participation, and future autonomous architecture.
- Existing Hardhat, CommonJS, contract layout, deploy flow, and Phase 1 tests.
- Existing `contracts/`, `scripts/deploy.js`, and smart-contract-centric architecture.

## Deliberately Not Changed
- No migration away from Hardhat.
- No repo-wide rewrite into a human-only architecture.
- No contract-first compliance engine.
- No scattering of legal workaround logic across existing protocol modules.
- No contract writes required for compliant legal validity.

## Consequences
- Compliant flows fail closed when policy, human review, ceremony, evidence, or provider requirements are missing.
- Evidence bundles now separate AI recommendations, human review, legal authority execution, and optional protocol publication.
- Future law or market structure changes can move the authority boundary later by swapping overlay providers and policy, rather than rewriting the protocol core.
