# COPPA Launch Plan (Deferred Until Product Stabilization)

Last updated: 2026-02-19
Owner: Product + Engineering + Legal
Status: Planned, not started

## Purpose
- Capture the concrete COPPA work needed before U.S. production launch.
- Keep implementation details ready while core product stability work is prioritized first.

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
- Formal parental consent records and policy text.
- Data export and deletion endpoint UX.
- Legal review before production launch.

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

## Deferred Implementation Plan

### Phase A: Legal And Policy Foundations
1. Publish a COPPA-compliant privacy policy page.
2. Draft parent direct notice copy and delivery flow.
3. Decide and document verifiable parental consent (VPC) method(s).
4. Document provider/subprocessor list and data-sharing descriptions.
5. Record retention and deletion policy in parent-facing language.

Deliverables:
- `/privacy` content ready for production.
- Internal legal packet with approved text and VPC method.

### Phase B: Consent Gating In Product
1. Add parent consent state model (for example: `pending`, `granted`, `revoked`).
2. Gate child profile creation and session start on active consent.
3. Log consent events (method, timestamp, policy version, actor, revocation details).
4. Add parent UI to view consent status and revoke consent.

Suggested schema additions:
- `parent_consents` table with versioned records.
- Optional denormalized `parents.consent_status` for quick checks.

### Phase C: Parent Rights Workflows
1. Parent review surface for child data categories collected.
2. Parent-initiated export flow for child-related data.
3. Parent-initiated deletion flow for child account/session/transcript data.
4. Revocation flow that stops further collection and disables new sessions.

Suggested API additions:
- `GET /api/privacy/child-data-summary`
- `POST /api/privacy/export`
- `POST /api/privacy/delete`
- `POST /api/privacy/consent/revoke`

### Phase D: Vendor And Security Controls
1. Maintain written assurances and data processing terms with providers:
   - Anthropic
   - Google Speech
   - Supabase
   - Vercel
2. Confirm no unauthorized secondary use of child data.
3. Formalize written information security program for child data.
4. Add documented incident workflow for child-data events.

### Phase E: Verification And Launch Evidence
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

## Suggested Trigger To Start This Work
Start Phase A/B when:
- P0/P1 backlog is clear (currently already clear).
- Current stabilization goals are met (voice UX/auth/testing hardening).

Do not defer beyond pre-production launch freeze.

## Open Decisions Needed Later
1. Which VPC method(s) to implement first.
2. How export should be delivered (download vs emailed secure link).
3. Deletion SLA and async-job design for large transcript sets.
4. Whether to geo-segment privacy behavior for non-U.S. users in v1.

## Source Notes
Primary legal references to validate with counsel during implementation:
- FTC COPPA Rule and FAQs.
- 16 CFR Part 312, including updated provider-assurance and security obligations.

This document is an engineering planning artifact, not legal advice.
