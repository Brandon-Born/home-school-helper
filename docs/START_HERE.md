# START HERE (Next Agent Onboarding)

## Fast Read Order (10-15 minutes)
1. `/Users/bborn/home-school-helper/docs/PROJECT_PLAN.md`
2. `/Users/bborn/home-school-helper/AGENT.md`
3. `/Users/bborn/home-school-helper/docs/handoffs/HANDOFF_LOG.md` (latest entry first)
4. `/Users/bborn/home-school-helper/docs/API_CONTRACT.md`
5. `/Users/bborn/home-school-helper/docs/DB_SCHEMA_AND_RLS.md`

## Current Goal
Implement Supabase-backed persistent session + auth + realtime so parent/child shared session behavior is production-ready.

## Current Status Snapshot
- Tutor pipeline exists and is Anthropic-only.
- Guardrails exist (scaffold-first + explicit override).
- Two API routes exist (`child-turn`, `parent-nudge`).
- Parent nudge queue is currently in-memory and must be replaced.

## First Tasks To Execute
1. Add Supabase schema and RLS from `DB_SCHEMA_AND_RLS.md`.
2. Replace in-memory queue with persistent messages + realtime events.
3. Implement onboarding/session-code flows in API and UI.
4. Add integration tests for visibility and authorization boundaries.

## Hard Rules
- Never expose `ANTHROPIC_API_KEY` in client code.
- Do not bypass server guardrails.
- Update handoff log for every runtime code change.
- Keep parent hidden guidance private from child output.

## Validation Commands
- `npm test`
- `npm run check:env`
- `npm run check:handoff`

## Before You Stop
1. Update `/Users/bborn/home-school-helper/docs/handoffs/HANDOFF_LOG.md`.
2. Document any changed architecture decision in `/Users/bborn/home-school-helper/docs/architecture/DECISIONS.md`.
3. Confirm README links are still accurate.
