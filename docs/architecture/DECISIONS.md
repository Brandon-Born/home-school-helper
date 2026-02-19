# Architecture Decisions

## ADR-001: Anthropic As Sole Tutor LLM (v1)
- Status: Accepted
- Date: 2026-02-17
- Decision:
  - Use Anthropic for all tutor generation in v1.
  - Configure via server-side env vars: `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- Rationale:
  - Reduces provider complexity while guardrails and pedagogy are being established.
  - Supports clear auditing and deterministic model routing in early stage.
- Consequences:
  - Future provider abstraction can be added after v1 safety metrics stabilize.

## ADR-002: Scaffold-First Guardrail Baseline
- Status: Accepted
- Date: 2026-02-17
- Decision:
  - Enforce scaffold-first output by default.
  - Permit direct answers only when explicit parent override is set.
- Rationale:
  - Product learning objective is guided understanding, not answer delivery.
- Consequences:
  - Requires policy checks and possible rewrite pass before child output.

## ADR-003: Handoff Continuity Enforcement
- Status: Accepted
- Date: 2026-02-17
- Decision:
  - Require `docs/handoffs/HANDOFF_LOG.md` updates when runtime code changes.
  - Enforce via CI script in pull requests.
- Rationale:
  - Reduces context loss across agents and improves continuity.
- Consequences:
  - Slightly more process overhead on every runtime code change.

## ADR-004: Session Foundation Auth Model
- Status: Accepted
- Date: 2026-02-17
- Decision:
  - Parent APIs use Supabase access token via `Authorization: Bearer <token>`.
  - Child access is granted only through one-time session code redemption.
  - Redeeming a join code issues a scoped child session token used by child-turn APIs.
- Rationale:
  - Keeps child UX low-friction (no child account login) while maintaining server-enforced access boundaries.
  - Supports hidden parent channel separation and scoped authorization per live session.
- Consequences:
  - Requires secure token hashing and expiry handling in backend storage.
  - Requires migration and policy setup before production use.

## ADR-005: Server-Trusted Tutor Context
- Status: Accepted
- Date: 2026-02-17
- Decision:
  - Child-facing tutor generation must use context loaded from server-owned session state (`sessions`, `children`, `messages`, `overrides`).
  - Client payload fields such as `profile`, `daily_context`, `parent_guidance`, and `allow_direct_answer` are not trusted for policy decisions.
- Rationale:
  - Prevents child clients from escalating permissions or bypassing scaffold-first behavior by crafting request payloads.
  - Keeps hidden parent channel and override controls enforceable at backend boundaries.
- Consequences:
  - Tutor routes require additional DB reads per request.
  - Cache/optimization can be added later, but correctness takes priority in v1.

## ADR-006: Transcript Transport via Authenticated SSE
- Status: Accepted
- Date: 2026-02-17
- Decision:
  - Use authenticated SSE endpoint (`GET /api/session/:id/stream`) for live transcript delivery to parent and child clients.
  - Parent streams can see all session messages; child streams are filtered to `child_and_parent` messages.
- Rationale:
  - Replaces inefficient polling while preserving existing server-side authorization boundaries.
  - Avoids exposing parent access token in URL query by using header-authenticated `fetch` streams.
- Consequences:
  - Current implementation polls DB server-side and emits incremental events over SSE.
  - Direct Supabase Realtime channel fan-out can be adopted later if needed for higher scale.

## ADR-007: COPPA Consent Gate At Collection Boundaries
- Status: Accepted
- Date: 2026-02-19
- Decision:
  - Add parent consent state (`pending`, `granted`, `revoked`) on `parents` plus append-only consent audit rows in `parent_consents`.
  - Enforce consent gate at child-data collection boundaries:
    - child profile creation (`POST /api/children`)
    - session start (`POST /api/session/start`)
  - Expose parent consent checkpoint API (`GET|POST /api/privacy/consent`) and parent-console controls.
- Rationale:
  - Meets COPPA-first requirement with minimal workflow change and no tutor-loop rewrite.
  - Keeps gating centralized on server-side trust boundaries where data collection begins.
- Consequences:
  - Adds one lightweight parent setup checkpoint before first child profile/session.
  - Requires schema migration before strict enforcement in deployed environments.
  - Local/dev compatibility fallback auto-disables gate when consent schema objects are absent.
  - Parent review baseline is exposed as aggregate metadata (`GET /api/privacy/child-data-summary`) rather than raw transcript export in this phase.
