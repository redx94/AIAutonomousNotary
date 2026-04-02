# Policy Engine

## Model
The policy engine is data-driven and jurisdiction-aware. It evaluates:
- jurisdiction
- act type
- document type
- signer location
- authority location
- legal mode
- active provider type
- identity proofing state
- AI risk score and fraud signals
- publication mode

## Output
Every evaluation returns a structured `PolicyDecision` containing:
- allow/block result
- block reason
- required authority mode
- human supervision, ceremony, and final signoff requirements
- required flow steps
- required evidence artifacts
- required identity checks
- retention and recording policy
- warnings
- policy version

## Fail-Closed Behavior
- No matching policy: block
- Invalid policy set: startup failure
- Provider mismatch: block
- Missing identity checks: block
- Blocked fraud signal: block
- Risk score above threshold: block

## Rule Source
Default rules live in `overlay/policy/data/defaultRules.json`. Add or extend rules there rather than scattering legal conditionals across the repo.
