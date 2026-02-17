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
- Session foundation APIs now exist:
  - `GET /api/parent/me`
  - `GET|POST /api/children`
  - `POST /api/session/start`
  - `POST /api/session/join`
- Child-turn now requires child session token; parent-nudge now requires authenticated parent ownership.
- Messages are persisted in `messages` table via server routes.
- Supabase migration exists at `supabase/migrations/20260217040000_session_foundation.sql`.
- Minimal UI flows now exist:
  - `/parent` for auth, child profile creation, session start, nudges, transcript polling.
  - `/child` for join-code redemption and chat turn submission.

## First Tasks To Execute
1. Replace polling with Supabase realtime subscriptions for live transcript updates.
2. Add voice input/output integration (push-to-talk + TTS fallback) in `/parent` and `/child` experience as appropriate.
3. Add integration tests for token redemption, session ownership, and visibility constraints.
4. Harden OAuth UX and session refresh handling for multi-device reliability.

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
