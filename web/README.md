# AI Autonomous Notary — Frontend

A thin but investor-grade frontend blueprint for the AI Autonomous Notary protocol.

## Architecture Alignment

This frontend faithfully expresses the existing repository architecture:

### Core vs Overlay Boundary

The existing repo has:
- **Protocol Core**: Smart contracts in `contracts/` (DocumentRegistry, NotaryNFT, etc.)
- **Compliance Overlay**: Human-supervised off-chain authority flow in `overlay/`

This UI respects that boundary:
- AI findings are **advisory only** — never presented as final authority
- Human decisions are **authoritative** in compliant mode
- Protocol publication is **downstream and separate** from legal validity

### Authority Model

```
Signer → Document → AI Analysis → Identity → Policy → Human Review → Ceremony → Finalization → (Optional Publication)
                          ↓
                    AI Advisory (non-authoritative)
                          ↓
              Human Authority (legally operative)
                          ↓
         Evidence Bundle (source of legal truth)
                          ↓
         Protocol Publication (downstream attestation)
```

## Project Structure

```
src/
├── components/
│   ├── ui/                 # Core UI components (StatusBadge, StepTracker)
│   ├── authority/          # Authority boundary components
│   │   ├── AIAdvisoryLabel.tsx      # Always labels AI output as advisory
│   │   ├── HumanAuthorityLabel.tsx  # Marks human decisions as authoritative
│   │   ├── ProtocolPublicationLabel.tsx  # Separates publication from legal status
│   │   └── LegalStatusCard.tsx      # Shows legal completion distinctly
│   ├── evidence/           # Evidence and audit components
│   │   ├── EventTimeline.tsx        # Audit trail visualization
│   │   ├── RiskBandCard.tsx         # AI risk display
│   │   └── EvidenceIntegrityCard.tsx # Bundle verification
│   ├── ceremony/           # Ceremony and finalization
│   │   ├── CeremonyArtifactPanel.tsx
│   │   ├── FinalizationChecklist.tsx
│   │   └── ReviewDecisionPanel.tsx
│   └── layout/             # Layout components
│       ├── Layout.tsx
│       ├── Navigation.tsx
│       └── RoleSwitcher.tsx
├── screens/
│   ├── signer/             # Signer-facing screens
│   │   ├── SignerHome.tsx
│   │   ├── DocumentIntake.tsx
│   │   ├── AIFindings.tsx
│   │   ├── IdentityProofing.tsx
│   │   ├── CaseDetail.tsx
│   │   ├── SessionPrep.tsx
│   │   ├── LiveSession.tsx
│   │   └── FinalPackage.tsx
│   ├── notary/             # Notary console screens
│   │   ├── NotaryQueue.tsx
│   │   └── NotaryCaseReview.tsx
│   ├── compliance/         # Compliance/ops screens
│   │   └── CaseLedger.tsx
│   └── verifier/           # Public verification
│       └── VerificationPortal.tsx
├── services/               # API service layer
│   └── caseService.ts      # Mock service respecting authority model
├── store/                  # State management
│   └── useCaseStore.ts     # Zustand store
├── data/                   # Mock data
│   └── mockCases.ts        # Mock cases with proper states
├── types/                  # TypeScript types
│   └── index.ts            # All domain types matching overlay
└── lib/
    └── utils.ts            # Utility functions
```

## Design System

### Color Palette (Trust-Focused)

| Color | Use |
|-------|-----|
| Neutral base | Primary backgrounds |
| Indigo/Cobalt | Primary actions, human authority |
| Emerald | Success, completion |
| Amber | Warning, pending states |
| Crimson | Danger, refusal, high risk |
| Violet/Blue | Protocol layer only |
| Slate | AI advisory distinction |

### Typography

- **Sans-serif**: Inter, system-ui for all UI text
- **Monospace**: Fira Code for hashes, IDs, technical data

### Spacing

- Roomy layouts with clear visual hierarchy
- High-risk actions have breathing room
- Only step transitions use motion

## State Model

The UI reflects these exact states from the overlay:

```typescript
type CaseState =
  | 'DRAFT'
  | 'INTAKE_COMPLETE'
  | 'AI_ANALYZED'
  | 'IDENTITY_PENDING'
  | 'IDENTITY_COMPLETE'
  | 'POLICY_BLOCKED'
  | 'REVIEW_PENDING'
  | 'REVIEW_COMPLETE'
  | 'CEREMONY_PENDING'
  | 'CEREMONY_COMPLETE'
  | 'FINALIZED_OFFCHAIN'
  | 'REFUSED'
  | 'PUBLICATION_PENDING'
  | 'PUBLISHED'
  | 'PUBLICATION_FAILED';
```

## Non-Negotiable UX Rules

1. **AI findings always labeled advisory** — `AIAdvisoryLabel` component
2. **Human decisions labeled authoritative** — `HumanAuthorityLabel` component
3. **Publication status visually separate** from legal completion
4. **Buttons disable when steps missing** with clear explanations
5. **Notary controls legal transitions** during sessions
6. **Refusal is a first-class path** — never hidden
7. **Evidence is inspectable** — not buried in menus
8. **Guided UX** — not an admin CRUD table

## Mock/Real Boundary

### What's Mocked

- Case data (`data/mockCases.ts`)
- Service layer (`services/caseService.ts`)
- AI analysis results
- Identity verification flow

### What Maps to Real Repo

- State model matches `overlay/models/ActContext.js`
- Event types match `overlay/evidence/EventTypes.js`
- Policy structure matches `overlay/policy/data/defaultRules.json`
- Authority flow follows `overlay/orchestrators/CompliantActOrchestrator.js`

## Running the UI

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The UI will be available at `http://localhost:5173`

## Role Switching

Use the role switcher in the top-right to view different perspectives:

- **Signer**: Document upload, identity, session, final package
- **Notary**: Queue, case review, decision making
- **Compliance**: Case ledger, audit trails
- **Verifier**: Public verification portal

## Screen Map

| # | Screen | Path | Role |
|---|--------|------|------|
| 1 | Signer Home | `/signer` | Signer |
| 2 | Document Intake | `/signer/upload` | Signer |
| 3 | Identity Proofing | `/signer/identity` | Signer |
| 4 | AI Findings | `/signer/ai-findings` | Signer |
| 5 | Case Detail | `/signer/case` | Signer |
| 6 | Session Prep | `/signer/session-prep` | Signer |
| 7 | Live Session | `/signer/session` | Signer |
| 8 | Final Package | `/signer/final` | Signer |
| 9 | Notary Queue | `/notary` | Notary |
| 10 | Case Review | `/notary/case` | Notary |
| 11 | Case Ledger | `/compliance` | Compliance |
| 12 | Verification Portal | `/verify` | Verifier/Public |

## Integration Path

To connect to real backend:

1. Replace `services/caseService.ts` with real API calls
2. Connect to overlay orchestrator endpoints
3. Add authentication (SIWE recommended)
4. Integrate with contract ABIs for publication status
5. Add WebSocket for real-time session updates

## Compliance Notes

This UI implements the compliant mode requirements:

- Human supervision required for all legally operative acts
- AI remains strictly advisory
- Evidence bundle is source of legal truth
- Protocol publication is optional downstream step
- Refusal path is explicit and defensible
