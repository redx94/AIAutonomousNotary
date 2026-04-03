# Partner & Buyer Outreach Strategy

## Context

This document is the operational companion to the Friday Positioning Memo (`11_FRIDAY_POSITIONING_MEMO.md`). It provides a tiered target list, rationale for each target, and a recommended contact sequence based on fit between the current repo and each company's existing business lines.

The order is: trust/compliance/notary first → real-estate workflow second → identity rails third → broad platform giants fourth → tokenization narrative last.

---

## Pre-Outreach Checklist

Do not send a single email until:

- [ ] GitHub About section has a description, website link, and topics set (do this in GitHub Settings)
- [ ] At least one release is published on GitHub (even v0.1.0-alpha with release notes)
- [ ] The README leads with compliance-aware notarization, not "tradeable Web3 asset class"
- [ ] The "What Exists Today" table in the README accurately reflects current state
- [ ] The live demo is working and takes under 90 seconds to walk through
- [ ] Valuation targets are not in the first page of any document you hand someone

---

## Tier 1 — Best Immediate Targets

These companies have the highest overlap between their current product and the compliance overlay. First conversations should be framed as: *"We built something adjacent to your moat — can we show you what it does?"*

### 1. Proof

**What they do:** Identity-centric security platform with a notary product. Emphasizes NIST IAL2-verified notaries, WebTrust certification, AATL-compatible digital certificates, compliance-first architecture.

**Why the fit is strong:**
- Compliance overlay maps directly to Proof's trust/compliance positioning
- Fraud-analysis advisory layer is additive to their trust narrative
- Evidence chain and structured audit bundle are categories they already care about
- The authority boundary (AI advisory, human legally operative) aligns with how they describe their own model

**Angle for first contact:** "We built a compliance and evidence orchestration layer for RON workflows. Your platform already has the notary execution. We have the policy engine, evidence spine, and programmable post-notarization controls. Can we show you 20 minutes of it?"

**Do not lead with:** tokenization, fractionalization, NFTs, or the $NOTARY token.

---

### 2. OneSpan

**What they do:** OneSpan Notary offers RON with ID verification, KBA, remote ID presentation, virtual rooms, and session recording. Broader OneSpan platform covers e-signature, identity verification, and digital agreements.

**Why the fit is reasonable:**
- Compliance overlay enhances the trust/evidence layer around their existing RON product
- Document-linked programmability is a capability they do not yet have
- Potential to extend into document-backed asset experiments as a pilot

**Angle for first contact:** "We have a compliance orchestration layer for RON that structures the evidence bundle, enforces jurisdiction policy rules, and creates a programmable post-notarization record. Does that extend anything you're working on?"

---

### 3. Qualia

**What they do:** Digital real-estate closing platform — title, escrow, and eClosing products. Serves title agencies, escrow officers, and real-estate attorneys.

**Why the fit is reasonable:**
- Qualia needs defensible audit trails for closing documents
- The compliance overlay's evidence bundle is exactly what a title underwriter would inspect
- Real-estate/title is the identified beachhead wedge (see `docs/wedge/real-estate-title.md`)

**Angle for first contact:** "We're building compliance and evidence infrastructure for legally significant document workflows. Your eClosing product would benefit from a structured audit bundle that satisfies title underwriter requirements and is optionally anchored on-chain. Can we show you the demo?"

---

### 4. Pavaso

**What they do:** RON platform and digital closing — directly in remote online notarization and eClosing for mortgage/title.

**Why they are a target:**
- Direct overlap with the real-estate/title wedge
- Natural design-partner candidate
- Plausible tuck-in acquisition target if the overlay proves a differentiated capability they do not own

**Angle for first contact:** Same as Qualia, with heavier emphasis on RON compliance and ceremony artifact generation.

---

### 5. Stavvy

**What they do:** eClosing and RON products for real-estate/mortgage workflows.

**Why they are a target:**
- Same buyer persona and workflow as Pavaso/Qualia
- The workflow buyer already feels the pain; they do not need to be convinced that document trust matters

**Angle for first contact:** Focus on MISMO-aligned evidence artifacts and jurisdiction-configurable policy engine.

---

## Tier 2 — Strategic Buyers After One Pilot

These companies have distribution and brand. They will not engage on the basis of architecture alone. A successful design-partner proof with a Tier 1 target changes that conversation significantly.

### 6. DocuSign

**What they do:** Dominant e-signature platform with an existing online notary product.

**Why they matter:**
- Distribution: 1.5M+ customers who already need the next step beyond signing
- Obvious strategic overlap with the compliance and document-trust layer
- Not currently a buyer of a repo; would care only after a differentiated compliance/evidence asset is proven in production

**When to contact:** After a Tier 1 pilot produces a concrete evidence bundle artifact or MISMO certification progress.

---

### 7. NotaryCam

**What they do:** Direct RON operator — one of the earlier market entrants.

**Why they are a target:**
- Decent pilot or partnership candidate
- Weaker strategic buyer than Proof or DocuSign because distribution and platform breadth are smaller
- Good for a design-partner conversation if Tier 1 targets do not move quickly

---

## Tier 3 — Integration Partners That Make the Product Credible

These are not buyers. They are the infrastructure that turns the compliance overlay from a well-designed architecture into something a production buyer can trust.

### Persona

**What they do:** Composable identity platform — government ID verification, liveness detection, KBA, webhook-driven workflow.

**Why you need them:** Production identity proofing is an explicit next-stage gap. Persona's API-first design maps directly onto the overlay's orchestration pattern. See `docs/integrations/identity-verification.md` for the integration plan.

**Engagement type:** Vendor integration, not a partnership conversation. Start with their sandbox API.

---

### Socure

**What they do:** AI-powered identity, risk, and compliance — strong in KYC/AML for financial institutions.

**Why you might use them instead:** If the target buyer is a mortgage/title operator (Qualia, Pavaso, Stavvy), Socure's credentialing story resonates more with their compliance teams than Persona's developer-first positioning.

---

### AU10TIX

**What they do:** Document verification and identity authentication with KYC/AML workflow integration.

**Why they are relevant:** AU10TIX adds document-level forgery detection signals that feed the AI advisory risk layer — useful when the document itself (not just the person) is a trust target.

---

### MISMO

**What they do:** Mortgage Industry Standards Maintenance Organization — the standards body for RON in the mortgage/title space.

**Why they matter:** MISMO certification is not optional theater for serious buyers in the real-estate/title wedge. Their review covers identity verification, AV requirements, notarial records, audit trails, and demonstration evidence — all categories the overlay addresses. Engage MISMO to understand the certification path; do not wait until a buyer asks whether you are MISMO-compliant.

---

## Tier 4 — Narrative Extension Partners (Not First Calls)

These conversations happen after the beachhead is proven. Raise them in fundraising conversations to show that the expansion story is real, but do not lead with them in product outreach.

### Tokeny / ERC-3643 Ecosystem

**What they do:** Tokeny positions ERC-3643 as the permissioned-token standard for compliant asset tokenization.

**Why they matter later:** The compliance overlay's architecture already references ERC-3643-style controls. If the beachhead succeeds and document-backed asset tokenization becomes a real product surface, Tokeny is a natural technical alignment partner.

---

### Securitize

**What they do:** Leading RWA tokenization platform — tokenized equities, bonds, and real-world assets.

**Why they matter later:** Relevant only after proving there is a real category for document-linked assets, not just document execution. Good long-game target; weak immediate target.

---

## Recommended Contact Sequence

| Priority | Company | Angle | Tier |
|---------|---------|-------|------|
| 1 | Proof | Compliance/trust/evidence overlap | 1 |
| 2 | OneSpan | RON enhancement / document programmability | 1 |
| 3 | Qualia | eClosing evidence and audit trail | 1 |
| 4 | Pavaso | RON + eClosing design partner | 1 |
| 5 | Stavvy | eClosing workflow augmentation | 1 |
| 6 | Persona | IDV integration (vendor, not partner call) | 3 |
| 7 | Socure | IDV integration alternative | 3 |
| 8 | DocuSign | Strategic buyer after pilot evidence | 2 |
| 9 | NotaryCam | Pilot candidate if Tier 1 is slow | 2 |
| 10 | MISMO | Certification path inquiry | 3 |
| 11 | Tokeny | Narrative extension after beachhead | 4 |
| 12 | Securitize | Long-game RWA expansion | 4 |

---

## What a First Outreach Email Should Include

1. **One sentence on what the repo is** — compliance overlay for legally operative digital notarization, with structured evidence bundles, fail-closed policy engine, and optional on-chain anchoring.
2. **One sentence on why it is relevant to them** — specific to their product line, not generic.
3. **A link to the live demo** — 90 seconds to walk through, no wallet required.
4. **One concrete ask** — a 20-minute call, not a pitch deck, not a partnership agreement.

What it should not include:
- Valuation figures
- Five-year revenue projections
- Token economics
- "Decentralized" or "Web3" in the subject line for a Tier 1/2 target
