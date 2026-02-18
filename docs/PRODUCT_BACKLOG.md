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
Status: Open
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

### UAT-BUG-2) Child cloud TTS synth returns 503 during normal tutoring turns (Highest)
Status: Open
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

### UAT-BUG-3) Next.js 15 dynamic route params are accessed synchronously (Highest)
Status: Open
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

### 1) Enforce TTS-safe assistant output end-to-end
Status: Open
Problem:
- Tutor outputs can include markdown-like formatting, symbols, and emoji that read poorly in TTS.
Scope:
- Add explicit plain-spoken style constraints in tutor prompt policy.
- Add server-side normalization for `speak_payload.text` (strip markdown markers/emojis where appropriate).
- Keep transcript readability while optimizing spoken output.
Success metric:
- Cloud/browser TTS outputs are consistently natural and free from markdown artifacts.

### 2) Parent active session rejoin/code coherence
Status: Open
Problem:
- Parent rejoin/regenerate code UX can drift from latest session metadata.
Scope:
- Ensure active session payload always has current join code/expiry context (or fetch on rejoin).
- Keep `activeSession` and `activeSessions` synchronized after manage/start actions.
Success metric:
- Rejoin and "new code" flows always display current code and expiry without manual refresh.

### 3) Distributed rate limiting backend
Status: Open
Problem:
- Current limiter is process-local; scaling can reduce effectiveness.
Scope:
- Move rate-limit counters to shared backing store (Redis/Upstash/Supabase strategy).
- Preserve existing policy keys/scopes.
Success metric:
- Rate limits remain consistent across multi-instance deployment.

### 4) Close rate-limit coverage gaps on session management routes
Status: Open
Problem:
- `GET /api/session/active` and `POST /api/session/[id]/manage` currently bypass route-level throttling.
Scope:
- Add dedicated policies in `src/server/rate-limit-policies.js` for active-session listing and manage actions.
- Enforce limits in both routes with stable parent/session-scoped keys.
- Add route tests for `rate_limited` responses and success-path non-regression.
Success metric:
- All parent session lifecycle endpoints enforce explicit, tested rate limits.

### 5) Stream disconnect/reconnect telemetry
Status: Open
Problem:
- Limited visibility into reconnect loops and stream churn.
Scope:
- Add structured client/server metrics for stream connect, clean close, reconnect attempts, and auth refresh loops.
Success metric:
- Can answer "how often are sessions reconnecting and why?" from logs/dashboard.

---

## P1 (High Value)

### 6) Replace polling-backed SSE with direct realtime transport
Status: Open
Problem:
- Polling interval adds latency and extra DB reads.
Scope:
- Evaluate migration path to Supabase Realtime or equivalent event push model.
- Preserve visibility filtering (`parent all` vs `child shared only`).
Success metric:
- Lower median transcript latency and lower polling load.

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
