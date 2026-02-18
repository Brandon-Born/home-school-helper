# Product Backlog (Living)

Last updated: 2026-02-18

Purpose:
- Capture high-impact product and engineering improvements beyond the current "working" baseline.
- Give future agents a prioritized queue to pull from without rediscovery.

How to use:
1. Start with the highest-priority open item.
2. If you change behavior, update `docs/API_CONTRACT.md` and related docs in the same PR.
3. Mark items as done in this file and summarize in `docs/handoffs/HANDOFF_LOG.md`.

---

## P0 (Highest Impact)

### UAT-BUG-1) Parent session metadata desync on start/rejoin (Highest)
Status: Done (2026-02-18)
Problem:
- In parent console, starting a new session can render the active-session card with missing child name and `Started NaNd ago` until a manual refresh.
- Rejoining/regenerating can leave the lesson panel without join code/expiry (`Share this code...` with blank code and `Expires at` with no timestamp).
Evidence (2026-02-18 UAT):
- Reproduced on `/parent` after `Create join code`, `📺 Rejoin`, and `🔄 New code`.
Scope:
- Ensure `activeSessions` entries are normalized with `child_name` and `started_at` immediately after start/rejoin/manage actions.
- Ensure `activeSession` always has current `join_code` and `expires_at` after rejoin/regenerate (no blank code state).
Success metric:
- Parent sees valid child name/time metadata immediately after session start.
- Rejoin/new-code flows always show the current join code and expiry in both active-session list and lesson panel without refresh.
Resolution notes:
- Covered by automated e2e lifecycle regression (`tests/playwright/parent-session-lifecycle.spec.js`) validating create -> regenerate -> rejoin -> end flow without metadata drift.

### UAT-BUG-2) Child cloud TTS synth returns 503 during normal tutoring turns (Highest)
Status: Done (2026-02-18)
Problem:
- Child flow repeatedly hits `POST /api/session/:id/speech/synthesize` with `503 Service Unavailable` after successful tutor replies.
- Console logs accumulate 503 errors during otherwise normal tutoring turns.
Evidence (2026-02-18 UAT):
- Observed on sessions `5c89baa6-0762-458d-bc58-f36e2d7cbb3e` and `b3f8f106-2f2c-43a8-a342-0b43f0126ddc` in browser console/network logs.
Scope:
- Verify and harden cloud TTS dependency checks/config loading for UAT/dev environments.
- Ensure reliable fallback path (browser TTS or silent mode) is explicit and does not emit repeated console-level resource errors for expected degradation.
- Add structured telemetry for synth failures by route/session.
Success metric:
- Configured environments return successful synth responses during normal turns, or fallback cleanly without repeated 503 console noise.
Resolution notes:
- Added cloud TTS cooldown policy (`app/child/hooks/voice/cloud-tts-policy.js`) and client-side circuit breaker in `useVoicePlayback` so repeated provider failures fall back to browser TTS without retrying cloud synth every assistant message.
- Added structured speech route failure telemetry including `session_id` in synth/transcribe routes.

### UAT-BUG-3) Next.js 15 dynamic route params are accessed synchronously (Highest)
Status: Done (2026-02-18)
Problem:
- Multiple dynamic API routes log runtime errors: `params should be awaited before using its properties`.
- This currently logs noisy runtime errors on hot paths and risks breakage with stricter Next.js behavior.
Evidence (2026-02-18 UAT):
- Observed repeatedly in dev server logs while exercising `/api/session/[id]/stream`, `/api/session/[id]/parent-nudge`, and `/api/session/[id]/speech/synthesize`.
Evidence (2026-02-18 automated Playwright):
- Reproduced during `npm run test:e2e` and `npm test` runs while child/parent session tests hit `GET /api/session/[id]/stream`.
- Runtime logs show synchronous access in `app/api/session/[id]/stream/route.js` (`params.id` used before awaiting `params`).
Scope:
- Update dynamic route handlers to await `params` per Next.js 15 dynamic API requirements.
- Add route-level regression tests for dynamic `params` access patterns in touched endpoints.
Success metric:
- No `params should be awaited` runtime errors during parent/child UAT flows.
Resolution notes:
- Updated dynamic routes to await `params` before using `id` (`stream`, `messages`, `child-turn`, `parent-nudge`, `override`, `speech/transcribe`, `speech/synthesize`).
- Added regression coverage in `tests/dynamic-route-params.test.js` using promised `params` objects.

### 1) Enforce TTS-safe assistant output end-to-end
Status: Done (2026-02-18)
Problem:
- Tutor outputs can include markdown-like formatting, symbols, and emoji that read poorly in TTS.
Scope:
- Add explicit plain-spoken style constraints in tutor prompt policy.
- Add server-side normalization for `speak_payload.text` (strip markdown markers/emojis where appropriate).
- Keep transcript readability while optimizing spoken output.
Success metric:
- Cloud/browser TTS outputs are consistently natural and free from markdown artifacts.
Resolution notes:
- Added explicit plain-spoken TTS instruction to tutor system prompt policy (`src/server/guardrails.js`).
- Added shared speech text normalizer (`src/server/tts-text.js`) and applied it in tutor turn `speak_payload` generation plus speech synth request validation.
- Added regression tests for prompt instruction and normalization behavior (`tests/guardrails.test.js`, `tests/security.test.js`, `tests/speech-route-validators.test.js`, `tests/tts-text.test.js`).

### 2) Parent active session rejoin/code coherence
Status: Done (2026-02-18)
Problem:
- Parent rejoin/regenerate code UX can drift from latest session metadata.
Scope:
- Ensure active session payload always has current join code/expiry context (or fetch on rejoin).
- Keep `activeSession` and `activeSessions` synchronized after manage/start actions.
Success metric:
- Rejoin and "new code" flows always display current code and expiry without manual refresh.
Resolution notes:
- Added persisted `sessions.active_join_code` and `sessions.active_join_code_expires_at` metadata so `/api/session/active` can return current code context across refresh/rejoin.
- Session lifecycle now keeps metadata synchronized on start/regenerate/redeem/end in `src/server/session-foundation/session-service.js`.
- Added service-level regression tests for list/regenerate/redeem coherence in `tests/session-auth-integration.test.js`.

### 3) Distributed rate limiting backend
Status: Done (2026-02-18)
Problem:
- Current limiter is process-local; scaling can reduce effectiveness.
Scope:
- Move rate-limit counters to shared backing store (Redis/Upstash/Supabase strategy).
- Preserve existing policy keys/scopes.
Success metric:
- Rate limits remain consistent across multi-instance deployment.
Resolution notes:
- Added shared Supabase-backed limiter backend with atomic RPC (`public.acquire_rate_limit_slot`) and bucket table migration (`supabase/migrations/20260218132000_backlog_top3.sql`).
- Updated `src/server/rate-limit.js` to support distributed mode with memory fallback and configurable backend selection (`RATE_LIMIT_BACKEND`).
- Added async limiter coverage for memory and distributed-store adapter paths (`tests/rate-limit.test.js`) and awaited rate-limit enforcement in all guarded session routes.

### 4) Close rate-limit coverage gaps on session management routes
Status: Done (2026-02-18)
Problem:
- `GET /api/session/active` and `POST /api/session/[id]/manage` currently bypass route-level throttling.
Scope:
- Add dedicated policies in `src/server/rate-limit-policies.js` for active-session listing and manage actions.
- Enforce limits in both routes with stable parent/session-scoped keys.
- Add route tests for `rate_limited` responses and success-path non-regression.
Success metric:
- All parent session lifecycle endpoints enforce explicit, tested rate limits.
Resolution notes:
- Added `sessionActiveList` and `sessionManage` policies in `src/server/rate-limit-policies.js`.
- Enforced limiter checks in `GET /api/session/active` and `POST /api/session/[id]/manage` using parent/session-scoped key suffixes.
- Added route coverage in `tests/session-management-routes.test.js` for both `429 rate_limited` behavior and success paths.

### 5) Stream disconnect/reconnect telemetry
Status: Done (2026-02-18)
Problem:
- Limited visibility into reconnect loops and stream churn.
Scope:
- Add structured client/server metrics for stream connect, clean close, reconnect attempts, and auth refresh loops.
Success metric:
- Can answer "how often are sessions reconnecting and why?" from logs/dashboard.
Resolution notes:
- Added server stream telemetry logger (`src/server/stream-telemetry.js`) and wired structured events through stream connect/failure/disconnect and poll error/recovery paths (`app/api/session/[id]/stream/route.js`, `src/server/transcript-stream-runtime.js`).
- Added client stream telemetry logger (`src/lib/stream-telemetry.js`) and wired structured connect/reconnect/disconnect metrics in `app/hooks/useSessionStream.js`.
- Added parent auth-refresh loop telemetry in `app/parent/hooks/useParentTranscriptStream.js` with attempt/success/failure signals.
- Added regression coverage for stream telemetry wiring in `tests/stream-route.test.js` and helper coverage in `tests/stream-telemetry.test.js`.

---

## P1 (High Value)

### 6) Replace polling-backed SSE with direct realtime transport
Status: Done (2026-02-18)
Problem:
- Polling interval adds latency and extra DB reads.
Scope:
- Evaluate migration path to Supabase Realtime or equivalent event push model.
- Preserve visibility filtering (`parent all` vs `child shared only`).
Success metric:
- Lower median transcript latency and lower polling load.
Resolution notes:
- Added direct stream transport using Supabase Realtime `messages` insert subscriptions in `src/server/session-foundation/message-service.js`.
- Updated stream runtime/route wiring to use realtime transport by default with configurable mode (`STREAM_TRANSPORT_MODE=auto|realtime|polling`) and automatic fallback to polling when realtime is unavailable.
- Preserved child visibility filtering in the runtime for realtime events (`child` streams only receive `child_and_parent` rows).
- Added regression coverage for realtime transport behavior and fallback paths in:
  - `tests/stream-route.test.js`
  - `tests/transcript-stream-runtime-telemetry.test.js`
  - `tests/dynamic-route-params.test.js`

### 7) Hook-level tests for client orchestration
Status: Open
Problem:
- Parent/child console hooks contain critical state machines with limited direct test coverage.
Scope:
- Add tests for `useSessionStream`, `useParentConsole`, and `useChildConsole` action/loading behavior.
- Cover reconnect, auth invalidation, and optimistic message merge paths.
Success metric:
- Regressions in session UX are caught before merge.

### 8) Voice observability and fallback-rate metrics
Status: Open
Problem:
- Limited visibility into cloud TTS/STT failures, timeout fallback rate, and playback errors.
Scope:
- Emit counters for timeout/retry/fallback/permission-denied/autoplay failures.
- Add dashboard-friendly log schema.
Success metric:
- Voice slowdown/failure complaints can be traced to concrete metrics quickly.

### 9) Parent action UX hardening
Status: Open
Problem:
- Some async failures are shown only as generic alerts; action-level feedback can be clearer.
Scope:
- Add targeted inline status for child CRUD, override, nudge, and session management outcomes.
- Preserve non-blocking behavior with per-action loading.
Success metric:
- Fewer ambiguous "buggy" reports from parents during rapid action sequences.

### 10) Decompose child voice capture/transcription runtime
Status: Open
Problem:
- `app/child/hooks/useChildVoiceRuntime.js` is still large and mixes capture/transcription state with orchestration.
Scope:
- Extract capture/transcription lifecycle into a focused hook/module (for example `useChildVoiceCapture`).
- Keep `useChildVoiceRuntime` as an orchestration layer with stable outward API.
- Add targeted tests for extracted capture state transitions and failure handling.
Success metric:
- Smaller hooks, clearer ownership boundaries, and easier regression testing for voice behavior.

### 14) Consolidate dynamic route handler boilerplate
Status: Open
Problem:
- Dynamic session routes repeat the same cross-cutting steps (await `params`, auth resolution, rate limiting, error wrapping), which increases regression risk and made Next.js 15 `params` sync issues easy to reintroduce.
Scope:
- Introduce shared route utility helpers for dynamic `sessionId` extraction and standardized handler composition.
- Migrate touched session routes to the helper pattern incrementally.
- Add one focused utility test suite to lock behavior.
Success metric:
- Dynamic routes share a single tested pattern for `params` extraction/error handling, reducing duplicate logic and preventing sync-param regressions.

### 15) E2E fixture isolation and deterministic selectors
Status: Open
Problem:
- E2E runs currently depend on accumulating real data in shared auth accounts, and some UI assertions can become brittle/slow when historical sessions/children pile up.
Scope:
- Add test-fixture conventions for creating and tearing down isolated parent/child/session data per spec.
- Introduce stable `data-testid` hooks for high-traffic controls (`join code`, `active session cards`, `rejoin/new code/end` actions).
- Keep UI smoke checks while moving protocol-level assertions to API responses where appropriate.
Success metric:
- Playwright suite remains stable at scale/repeated runs without flake from stale data or selector ambiguity.

### 16) Realtime channel lifecycle hardening
Status: Open
Problem:
- Stream runtime now supports multiple transport paths (`auto`, `realtime`, `polling`) and relies on channel subscribe/unsubscribe behavior that can be hard to reason about under reconnect churn.
Scope:
- Add defensive guards and explicit telemetry for channel subscribe/unsubscribe counts and close reasons across reconnect loops.
- Add integration coverage for repeated connect/disconnect cycles to catch channel leaks or duplicate handlers.
- Document operational runbook checks for realtime channel health in staging/production.
Success metric:
- No channel leak growth across repeated reconnects; reconnect behavior remains bounded and observable.

### 17) Transport-mode e2e coverage (realtime vs polling fallback)
Status: Open
Problem:
- Current automated browser tests validate transcript UX, but do not explicitly assert which stream transport mode was selected in runtime (`realtime` vs fallback `polling`).
Scope:
- Add Playwright scenarios that run with `STREAM_TRANSPORT_MODE=realtime` and `STREAM_TRANSPORT_MODE=polling`.
- Assert stream continuity and no duplicate transcript append behavior in both modes.
- Capture mode-specific telemetry assertions where practical.
Success metric:
- CI can catch regressions in either transport mode before merge.

---

## P2 (Quality / Delight)

### 11) Accessibility pass (parent + child)
Status: Open
Scope:
- Keyboard navigation review, ARIA states on dynamic controls, focus management after async actions.
- Ensure transcript updates are screen-reader friendly.

### 12) Performance polish for long sessions
Status: Open
Scope:
- Virtualize transcript rendering for very long message lists.
- Add message windowing while preserving full-history server access.

### 13) Product analytics baseline
Status: Open
Scope:
- Add privacy-safe funnel events (session start, child join success/fail, turn send, nudge send, voice usage).
- Define baseline activation and retention metrics for iteration.

---

## Parking Lot (Not Scheduled)

- Multi-language tutoring support.
- COPPA consent/export/deletion self-serve parent portal UX.
- Native mobile wrapper once web UX stabilizes.
