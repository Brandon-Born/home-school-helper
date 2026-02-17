# Project Plan: Homeschool Tutor (v1)

## 1. Objective
Deliver a web-based, mobile-friendly tutoring assistant for homeschool students with:
- Child voice-first learning experience.
- Parent live steering via hidden text channel.
- Scaffold-first tutoring guardrails by default.
- Anthropic-only tutor generation configured through Vercel environment variables.

## 2. Product Outcomes
- Children can ask questions naturally and receive guided help, not immediate answers.
- Parents can set context for each lesson and send private nudges during sessions.
- Sessions are safe, age-appropriate, and auditable.
- New agents can continue work quickly through durable docs and handoff logs.

## 3. Locked Constraints
- Deployment: Vercel.
- LLM provider: Anthropic only (v1).
- Required env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
- Default pedagogy: scaffold-first.
- Parent visibility model: hidden parent guidance channel.
- Child identity: one-time join code, no child login.
- Retention target: 30-day transcript retention, no raw audio storage.

## 4. Current State (as of 2026-02-17)
Implemented:
- Baseline Next.js project structure.
- Server config validation for Anthropic env vars.
- Server-only Anthropic call module.
- Guardrails and tutor response shaping pipeline.
- API routes:
  - `GET /api/parent/me`
  - `GET|POST /api/children`
  - `POST /api/session/start`
  - `POST /api/session/join`
  - `POST /api/session/:id/child-turn`
  - `POST /api/session/:id/parent-nudge`
  - `GET /api/session/:id/messages`
  - `POST /api/session/:id/override`
  - `GET /api/session/:id/stream`
- Supabase migration and RLS policy SQL scaffold (`supabase/migrations/20260217040000_session_foundation.sql`).
- Supabase migration applied and verified against remote project (`20260217040000`).
- Transcript retention automation migration (`supabase/migrations/20260217193000_transcript_retention.sql`) with daily 30-day purge schedule.
- Child session token auth on child-turn route.
- Parent session ownership auth on parent-nudge route.
- Initial web UI routes for parent and child operational flows (`/parent`, `/child`, `/auth/callback`).
- Session transcript SSE subscription flow implemented for parent/child clients.
- Agent operations docs (`AGENT.md`) and handoff system.
- CI guard for handoff log updates on runtime code changes.

Not yet implemented:
- Voice controls on parent surface (child cloud voice loop implemented).
- Production-grade realtime event fan-out and client subscription wiring.
- End-to-end tests and deployment hardening.

## 5. Execution Roadmap

### Phase 1: Backend Foundation (Session + Data)
Deliverables:
- Supabase project wiring and environment config.
- Core tables and policies (`parents`, `children`, `sessions`, `messages`, `session_codes`, `policy_events`, `overrides`).
- Parent Google auth flow and server session handling.
- Session code generation and redemption APIs.

Acceptance criteria:
- Parent can authenticate and create a child profile.
- Parent can start a session and generate one-time 10-minute join code.
- Child can redeem code exactly once and receive scoped session access.

### Phase 2: Realtime Parent/Child Experience
Deliverables:
- Parent UI for session setup and hidden nudges.
- Child UI for voice-first interactions and readable transcript.
- Realtime channels with strict parent/child visibility boundaries.

Acceptance criteria:
- Parent nudge appears as tutor utterance on child side in near real-time.
- Child cannot access hidden parent messages by API or UI paths.

### Phase 3: Voice + Tutor Quality
Deliverables:
- Push-to-talk capture UX.
- Hybrid TTS (browser primary, cloud fallback).
- Prompt assembly enhancements using child profile + daily context.

Acceptance criteria:
- Child can complete an interaction loop on mobile browser with voice input/output.
- Fallback paths work when speech input or browser voices fail.

### Phase 4: Safety, Observability, and Hardening
Deliverables:
- Expanded guardrail policy checks and policy event logging.
- Admin-facing metrics and error telemetry.
- Security controls for rate limiting and abuse prevention.

Acceptance criteria:
- Direct-answer leakage is blocked in default mode.
- Unsafe content classes are blocked in all modes.
- Model/prompt version are logged per tutor request.

### Phase 5: Launch Readiness
Deliverables:
- E2E test suite for critical parent/child flows.
- COPPA-first consent/deletion/export flows.
- Production runbooks for incident handling and rollback.

Acceptance criteria:
- CI covers unit + integration + E2E critical path.
- Documentation is complete for operations and continuity.

## 6. API/Interface Targets
Required response contract for tutor turn endpoints:
- `assistant_text`
- `speak_payload`
- `policy_applied`
- `model_used`

Required internal config module behavior:
- Parse and validate required env vars.
- Apply typed defaults for optional vars.
- Fail fast in startup checks when required values are absent.

## 7. Testing Strategy
- Unit tests:
  - Config validation behavior.
  - Guardrail rewrite and override logic.
  - No API key leakage in result payloads.
- Integration tests:
  - Session code issuance/redeem lifecycle.
  - Hidden parent channel visibility boundaries.
- E2E tests:
  - Parent onboarding -> session start -> child join -> guided tutoring flow.

## 8. Agent Continuity Rules
- Always read latest `docs/handoffs/HANDOFF_LOG.md` entry first.
- Execute listed next steps unless blocked by new constraints.
- Append a new handoff log entry before ending any significant change.
- Update this plan when priorities, constraints, or sequencing materially change.

## 9. Immediate Next Steps
1. Validate Google Speech STT/TTS configuration in local/Vercel and run end-to-end child voice tests.
2. Verify transcript retention migration (`20260217193000`) is applied in each deployed Supabase environment.
3. Evaluate migrating SSE transcript stream to direct Supabase Realtime channels.
4. Add E2E critical-path coverage for parent onboarding -> start session -> child join -> tutoring flow.
