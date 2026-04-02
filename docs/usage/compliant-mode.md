# Compliant Mode

## What It Means
`compliant` mode is the default runtime mode. It is designed for legally operative flows that require real human-supervised authority.

## Enforcement
- human commissioned provider only
- autonomous execution disabled
- explicit human review payload required
- explicit ceremony artifact/record required
- final human signoff required
- jurisdiction policy enforcement must remain enabled or compliant execution blocks
- strict evidence mode forces produced artifacts to satisfy policy requirements

## Legal Validity
Legal validity comes from the off-chain compliant workflow. Optional contract publication does not create legal validity and is not required for the authority record to exist.

## Validation Commands
```bash
npm run compliance:validate
npm run compliance:flow
npm run test:compliance
```
