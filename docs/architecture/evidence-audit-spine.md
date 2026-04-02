# Evidence And Audit Spine

## Goal
Every compliant execution must be reconstructable after the fact.

## Separation Of Records
Evidence bundles separate:
- AI output and recommendations
- human review and overrides
- ceremony completion
- off-chain authority execution
- optional protocol publication attempt/result

## Event Model
The overlay records structured events for AI analysis, policy issuance, review lifecycle, ceremony completion, authorization/refusal, finalization blocks, evidence bundle creation, and protocol publication outcomes.

## Bundle Contents
Recommended exported files:
- `manifest.json`
- `policy-decision.json`
- `ai-analysis.json`
- `human-review.json`
- `authority-execution.json`
- `protocol-publication.json`
- `evidence-index.json`
- `retention-policy.json`
- `hashes.json`
- `events.json`

## Publication Semantics
Publication records are separate from legal authority records. Transaction hashes appear only when downstream publication occurred.
