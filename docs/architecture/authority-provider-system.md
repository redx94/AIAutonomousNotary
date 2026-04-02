# Authority Provider System

## Providers
Two authority providers now exist behind one interface:

### `human_commissioned`
- Active provider in compliant mode
- Represents the real human-supervised authority path
- Verifies authority eligibility
- Performs ceremony, certificate completion, and final record signing through explicit provider methods

### `autonomous`
- Concrete dormant provider for future architecture
- Kept implemented and testable
- Blocked from legally operative compliant finalization
- Usable only in experimental or shadow contexts

## Selection Rules
- `compliant` mode requires `human_commissioned`
- `experimental` mode may use `autonomous` only when autonomous execution is explicitly enabled

## Design Goal
Autonomy remains a real architectural path, but today’s legally operative path is enforced in the overlay rather than buried into the core protocol modules.
