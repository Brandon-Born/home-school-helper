# START HERE (Next Agent Onboarding)

## Fast Read Order (10-15 minutes)
1. `/Users/bborn/home-school-helper/docs/PROJECT_PLAN.md`
2. `/Users/bborn/home-school-helper/AGENT.md`
3. `/Users/bborn/home-school-helper/docs/PRODUCT_BACKLOG.md` (pick highest-priority open item)
4. `/Users/bborn/home-school-helper/docs/handoffs/HANDOFF_LOG.md` (latest entry first)
5. `/Users/bborn/home-school-helper/docs/API_CONTRACT.md`
6. `/Users/bborn/home-school-helper/docs/DB_SCHEMA_AND_RLS.md`

## Current Goal
Stabilize cloud voice UX (Google STT V2 + Chirp 3), auth robustness, and launch-critical testing.

## Current Status Snapshot
- Tutor pipeline exists and is Anthropic-only.
- Guardrails exist (scaffold-first + explicit override).
- Session foundation APIs now exist:
  - `GET /api/parent/me`
  - `GET|POST /api/children`
  - `PUT|DELETE /api/children/:id`
  - `POST /api/session/start`
  - `GET /api/session/active`
  - `POST /api/session/join`
  - `POST /api/session/:id/manage`
  - `POST /api/session/:id/speech/transcribe`
  - `POST /api/session/:id/speech/synthesize`
- Child-turn now requires child session token; parent-nudge now requires authenticated parent ownership.
- Messages are persisted in `messages` table via server routes.
- Supabase migration exists at `supabase/migrations/20260217040000_session_foundation.sql`.
- Transcript retention migration exists at `supabase/migrations/20260217193000_transcript_retention.sql` (daily 30-day purge via `pg_cron`).
- Minimal UI flows now exist:
  - `/parent` for auth, child profile CRUD (create/edit/delete), session start, active session management (rejoin/end/regenerate code), nudges, and transcript subscription.
  - `/child` for join-code redemption, cloud voice capture/transcription, and cloud tutor speech playback.
- Realtime transcript updates now stream through `GET /api/session/:id/stream` (SSE).

## First Tasks To Execute
1. Pull the top open P0 item from `/Users/bborn/home-school-helper/docs/PRODUCT_BACKLOG.md`.
2. Verify transcript retention migration (`20260217193000_transcript_retention.sql`) is applied in each Supabase environment and cron job exists.
3. Verify Google Speech env config in each environment (local/Vercel) and run child cloud voice flow end-to-end.
4. Consider migrating SSE transcript stream to direct Supabase Realtime channels if lower-latency fan-out is needed.

## Hard Rules
- Never expose `ANTHROPIC_API_KEY` in client code.
- Do not bypass server guardrails.
- Update handoff log for every runtime code change.
- Keep parent hidden guidance private from child output.

## Validation Commands
- `npm test` (unit + Playwright e2e)
- `npm run test:unit` (unit only)
- `npm run test:e2e` (Playwright e2e only)
- `npm run check:env`
- `npm run check:handoff`
- Headed Playwright UAT for touched UI/session flows (parent and/or child), with findings recorded in backlog/handoff.

## Before You Stop
1. Update `/Users/bborn/home-school-helper/docs/handoffs/HANDOFF_LOG.md`.
2. Document any changed architecture decision in `/Users/bborn/home-school-helper/docs/architecture/DECISIONS.md`.
3. Confirm README links are still accurate.
