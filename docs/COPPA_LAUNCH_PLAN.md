# COPPA Launch Plan (In Progress)

Last updated: 2026-02-19
Owner: Product + Engineering + Legal
Status: In progress (Phase B + Phase C baseline shipped)

## Purpose
- Capture the concrete COPPA work needed before U.S. production launch.
- Keep implementation lightweight around existing workflows without changing tutor-loop core behavior.

## Direct Answer To Product Impact
Your assumption is partly right:
- Correct: COPPA work does not require changing the tutor loop itself (child turn -> model call -> response).
- Not correct: COPPA does affect launch-critical workflow gates around onboarding, session start eligibility, parent controls, legal notice surfaces, and data operations.

In practice, this is mostly additive around existing workflows, not a rewrite of the tutoring architecture.

## Current State In This Repo
Already aligned:
- Parent-authenticated access model for child/session management.
- Child scoped tokens and visibility boundaries.
- 30-day transcript retention and purge.
- No raw audio storage in v1.

Known gaps already documented:
- Verifiable parental consent (VPC) implementation is pending; current product flow records parent self-attestation only.
- Export delivery model and deletion SLA decisions (currently synchronous baseline UX).
- Legal/provider signoff before production launch.

## VPC Direction (2026-02-19)
Selected direction for first production VPC method:
- Use subscription billing with a separate parent payment verification transaction/authorization (before trial activation) as the primary VPC method.

Implementation requirements before launch:
- Present COPPA direct notice before billing-backed consent completion.
- Record consent as `granted` only after successful billing verification callback.
- Store auditable linkage from consent record to billing verification event (Stripe webhook event / payment intent evidence).
- Keep child profile creation and session start blocked until billing-backed consent is verified.

Important constraint:
- Current implementation still uses parent self-attestation in the consent checkpoint and is not yet billing-verified VPC.

## COPPA Scope For This Product
This product is child-directed and processes child personal information, including:
- Child profile data.
- Session transcripts.
- Voice uploads sent for transcription.

Therefore COPPA launch readiness requires:
- Direct notice and verifiable parental consent before collection/use.
- Parent rights to review, delete, and revoke consent.
- Written provider assurances for child data handling.
- Security and retention controls documented and enforced.

## Implementation Plan

### Phase A: Legal And Policy Foundations
Status: In progress
1. Publish a COPPA-compliant privacy policy page.
2. Draft parent direct notice copy and delivery flow.
3. Finalize legal review for the selected subscription-backed VPC method and notice copy.
4. Document provider/subprocessor list and data-sharing descriptions.
5. Record retention and deletion policy in parent-facing language.

Deliverables:
- `/privacy` content ready for production.
- Internal legal packet with approved direct notice text, selected VPC method, and launch signoff.

### Phase B: Consent Gating In Product
Status: Baseline implemented
1. Add parent consent state model (for example: `pending`, `granted`, `revoked`).
2. Gate child profile creation and session start on active consent.
3. Log consent events (method, timestamp, policy version, actor, revocation details).
4. Add parent UI to view consent status and revoke consent.

Suggested schema additions:
- `parent_consents` table with versioned records. Implemented.
- Denormalized parent consent columns for quick checks. Implemented.

Implemented endpoints:
- `GET /api/privacy/consent`
- `POST /api/privacy/consent` (`grant` | `revoke`)

Implemented behavior:
- Child profile creation and session start reject with `403 coppa_consent_required` unless consent is granted.
- Parent UI shows a consent checkpoint card and disables add/start controls until consent is granted.
- Backward compatibility fallback: if consent schema migration is missing in local/dev, consent gating auto-disables (`required=false`) to prevent deadlock.

Remaining Phase B upgrade for launch:
- Replace self-attestation grant path with billing-verified VPC grant path (separate parent payment verification, then subscription trial).

### Phase C: Parent Rights Workflows
Status: Baseline implemented
1. Parent review surface for child data categories collected.
2. Parent-initiated export flow for child-related data.
3. Parent-initiated deletion flow for child account/session/transcript data.
4. Revocation flow that stops further collection and disables new sessions.

Suggested API additions:
- `GET /api/privacy/child-data-summary` (implemented baseline)
- `GET /api/privacy/requests` (implemented baseline)
- `POST /api/privacy/export` (implemented baseline)
- `POST /api/privacy/delete` (implemented baseline)
- `POST /api/privacy/consent` with `action='revoke'` (already implemented baseline)

### Phase D: Vendor And Security Controls
Status: Not started
1. Maintain written assurances and data processing terms with providers:
   - Anthropic
   - Google Speech
   - Supabase
   - Vercel
2. Confirm no unauthorized secondary use of child data.
3. Formalize written information security program for child data.
4. Add documented incident workflow for child-data events.

### Phase E: Verification And Launch Evidence
Status: In progress (consent + parent-rights tests added)
1. Add integration tests for consent gating and revoked states.
2. Add tests for export/delete flow authorization and completeness.
3. Produce compliance evidence pack for go-live signoff:
   - Policy links
   - Consent records
   - Provider assurance docs
   - Test results
   - Incident runbook

## Workflow Touchpoints (What Will Change)
Minimal code-path changes:
- Parent onboarding: add direct notice + consent completion checkpoint.
- Child profile/session start: block when consent is missing/revoked.
- Parent settings/privacy: add review/export/delete/revoke tools.

No major structural change expected:
- Child tutoring turn orchestration.
- Hidden parent guidance model.
- Existing transcript stream architecture.

## Suggested Trigger To Continue
Continue Phase C-E now that baseline Phase B controls are in place.

## Open Decisions Needed Later
1. Which backup VPC method to support if subscription billing is unavailable (for example, manual verification flow).
2. How export should be delivered (download vs emailed secure link).
3. Deletion SLA and async-job design for large transcript sets.
4. Whether to geo-segment privacy behavior for non-U.S. users in v1.

## Source Notes
Primary legal references to validate with counsel during implementation:
- FTC COPPA Rule and FAQs: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- 16 CFR Part 312 (COPPA rule text): https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312

This document is an engineering planning artifact, not legal advice.
