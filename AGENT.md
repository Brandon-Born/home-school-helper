# Agent Operating Contract

## Product Mission
Build a web-based tutoring assistant for homeschool students that is voice-friendly for children and steerable by parents in real time, without compromising safety or learning integrity.

## Non-Negotiables
- Child safety and age-appropriate responses come before speed or convenience.
- Tutor defaults to scaffold-first guidance and avoids direct final answers.
- Parent steering context is hidden from the child.
- Anthropic is the only tutoring model provider in v1.
- Secrets must stay server-side and never be exposed to browser code.

## System Boundaries
- Browser responsibilities:
  - Child voice input UX and spoken output playback.
  - Parent text controls and session management UI.
- Server responsibilities:
  - Anthropic API calls.
  - Prompt assembly and guardrail enforcement.
  - Session policy decisions and audit logging.
- Prohibited in client code:
  - Direct Anthropic API usage.
  - Reading `ANTHROPIC_API_KEY` or any secret env var.
  - Bypassing guardrail pipeline for tutor output.

## Guardrail Policy Contract
- Default mode: scaffold-first tutoring.
- Direct answer policy:
  - Block direct answer style output unless `allow_direct_answer=true` is explicitly set by parent control flow.
- Unsafe content policy:
  - Always block unsafe classes even when direct-answer override is enabled.
- Parent message policy:
  - Treat parent input as hidden guidance; never reveal parent text verbatim in child-visible output.

## Realtime Protocol Summary
- Channels:
  - Parent channel: full transcript + policy status + control acknowledgements.
  - Child channel: child messages + tutor-safe outputs only.
- Event names:
  - `session.transcript.append`
  - `session.tutor.speak`
  - `session.parent.nudge.received`
  - `session.policy.alert`
  - `session.state.changed`
- Visibility rules:
  - Parent can view hidden guidance events.
  - Child cannot view hidden parent guidance or policy internals.

## How To Continue Work
0. Read `docs/START_HERE.md` first for read order and immediate priorities.
1. Read the project plan at `docs/PROJECT_PLAN.md` to align with roadmap and priorities.
2. Read `docs/PRODUCT_BACKLOG.md` and pick the highest-priority open item unless user directs otherwise.
3. Read the latest entry in `docs/handoffs/HANDOFF_LOG.md` before changing code.
4. Execute listed next steps in order unless blocked by new constraints.
5. If blocked, document the blocker and fallback attempt.
6. Before ending work, append a new handoff entry using `docs/handoffs/HANDOFF_TEMPLATE.md`.

## Definition Of Done
A task is complete only when all items below are true:
1. Code changes compile and tests/checks pass locally for touched areas.
2. Automated Playwright e2e specs are added/updated for touched UI/session behavior and pass in `npm test`; headed Playwright validation is also run for touched parent/child paths with outcomes documented.
3. Docs are updated for any behavior, interface, or policy change.
4. `docs/handoffs/HANDOFF_LOG.md` includes a new entry with outcomes and next actions.
5. No secrets are exposed in client paths or API responses.
