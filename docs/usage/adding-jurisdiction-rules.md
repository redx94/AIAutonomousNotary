# Adding Jurisdiction Rules

## Rule Location
Edit `overlay/policy/data/defaultRules.json`.

## Required Fields
Each rule should define:
- `jurisdiction`
- `actType`
- `documentType`
- signer and authority location scope
- legal modes
- provider types
- human supervision, ceremony, and signoff requirements
- required flow steps
- required evidence artifacts
- required identity checks
- retention and recording policy
- blocked fraud signals
- maximum risk score
- allowed publication modes

## Process
1. Add the new rule object.
2. Keep the rule data-driven; do not add scattered conditionals elsewhere.
3. Run `npm run compliance:validate`.
4. Add or update tests under `test/compliance-overlay/`.
5. Document any new jurisdiction-specific behavior if it changes operator expectations.
