# START HERE (Next Agent Onboarding)

## Fast Read Order (10-15 minutes)
1. `/Users/bborn/home-school-helper/docs/PROJECT_PLAN.md`
2. `/Users/bborn/home-school-helper/AGENT.md`
3. `/Users/bborn/home-school-helper/docs/handoffs/HANDOFF_LOG.md` (latest entry first)
4. `/Users/bborn/home-school-helper/docs/API_CONTRACT.md`
5. `/Users/bborn/home-school-helper/docs/DB_SCHEMA_AND_RLS.md`

## Current Goal
Stabilize cloud voice UX (Google STT V2 + Chirp 3), auth robustness, and launch-critical testing.

## Current Status Snapshot
- Tutor pipeline exists and is Anthropic-only.
- Guardrails exist (scaffold-first + explicit override).
- Session foundation APIs now exist:
  - `GET /api/parent/me`
  - `GET|POST /api/children`
  - `POST /api/session/start`
  - `POST /api/session/join`
  - `POST /api/session/:id/speech/transcribe`
  - `POST /api/session/:id/speech/synthesize`
- Child-turn now requires child session token; parent-nudge now requires authenticated parent ownership.
- Messages are persisted in `messages` table via server routes.
- Supabase migration exists at `supabase/migrations/20260217040000_session_foundation.sql`.
- Transcript retention migration exists at `supabase/migrations/20260217193000_transcript_retention.sql` (daily 30-day purge via `pg_cron`).
- Minimal UI flows now exist:
  - `/parent` for auth, child profile creation, session start, nudges, transcript subscription.
  - `/child` for join-code redemption, cloud voice capture/transcription, and cloud tutor speech playback.
- Realtime transcript updates now stream through `GET /api/session/:id/stream` (SSE).

## First Tasks To Execute
1. Verify Google Speech env config in each environment (local/Vercel) and run child cloud voice flow end-to-end.
2. Add deeper SSE sequencing tests for stream `snapshot` + `message_append` framing under deterministic harnesses.
3. Add route-level tests for speech and session endpoints covering rate-limit and provider-failure behavior.
4. Consider migrating SSE transcript stream to direct Supabase Realtime channels if lower-latency fan-out is needed.

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
