# Core vs Overlay Boundary

## Protocol Core
The protocol core is the existing Hardhat/solidity system in:
- `contracts/`
- `scripts/deploy.js`
- existing `test/Phase1*.test.js`

This layer remains responsible for protocol primitives such as notarization NFTs, document registries, AI/oracle mechanics, access control, and tokenization.

## Compliance Overlay
The overlay is responsible for:
- legally operative human-supervised execution
- data-driven policy enforcement
- fail-closed authority gating
- evidence and audit records
- optional downstream publication to the protocol core

## Explicit Non-Goals
- The overlay does not repurpose the core contracts into the compliance engine.
- The core contracts do not become the source of legal validity in compliant mode.
- Contract publication success is not a prerequisite for the existence of a valid compliant authority record.

## Why This Boundary Matters
This separation keeps the repository additive and reversible. If law changes later, authority can shift without requiring a destructive rewrite of the underlying protocol vision.
