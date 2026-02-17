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
