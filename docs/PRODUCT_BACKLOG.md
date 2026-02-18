# Product Backlog (Living)

Last updated: 2026-02-18

Purpose:
- Capture high-impact product and engineering improvements beyond the current “working” baseline.
- Give future agents a prioritized queue to pull from without rediscovery.

How to use:
1. Start with the highest-priority open item.
2. If you change behavior, update `docs/API_CONTRACT.md` and related docs in the same PR.
3. Mark items as done in this file and summarize in `docs/handoffs/HANDOFF_LOG.md`.

---

## P0 (Highest Impact)

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
- Rejoin and “new code” flows always display current code and expiry without manual refresh.

### 3) Distributed rate limiting backend
Status: Open
Problem:
- Current limiter is process-local; scaling can reduce effectiveness.
Scope:
- Move rate-limit counters to shared backing store (Redis/Upstash/Supabase strategy).
- Preserve existing policy keys/scopes.
Success metric:
- Rate limits remain consistent across multi-instance deployment.

### 4) Stream disconnect/reconnect telemetry
Status: Open
Problem:
- Limited visibility into reconnect loops and stream churn.
Scope:
- Add structured client/server metrics for stream connect, clean close, reconnect attempts, and auth refresh loops.
Success metric:
- Can answer “how often are sessions reconnecting and why?” from logs/dashboard.

---

## P1 (High Value)

### 5) Replace polling-backed SSE with direct realtime transport
Status: Open
Problem:
- Polling interval adds latency and extra DB reads.
Scope:
- Evaluate migration path to Supabase Realtime or equivalent event push model.
- Preserve visibility filtering (`parent all` vs `child shared only`).
Success metric:
- Lower median transcript latency and lower polling load.

### 6) Hook-level tests for client orchestration
Status: Open
Problem:
- Parent/child console hooks contain critical state machines with limited direct test coverage.
Scope:
- Add tests for `useSessionStream`, `useParentConsole`, and `useChildConsole` action/loading behavior.
- Cover reconnect, auth invalidation, and optimistic message merge paths.
Success metric:
- Regressions in session UX are caught before merge.

### 7) Voice observability and fallback-rate metrics
Status: Open
Problem:
- Limited visibility into cloud TTS/STT failures, timeout fallback rate, and playback errors.
Scope:
- Emit counters for timeout/retry/fallback/permission-denied/autoplay failures.
- Add dashboard-friendly log schema.
Success metric:
- Voice slowdown/failure complaints can be traced to concrete metrics quickly.

### 8) Parent action UX hardening
Status: Open
Problem:
- Some async failures are shown only as generic alerts; action-level feedback can be clearer.
Scope:
- Add targeted inline status for child CRUD, override, nudge, and session management outcomes.
- Preserve non-blocking behavior with per-action loading.
Success metric:
- Fewer ambiguous “buggy” reports from parents during rapid action sequences.

---

## P2 (Quality / Delight)

### 9) Accessibility pass (parent + child)
Status: Open
Scope:
- Keyboard navigation review, ARIA states on dynamic controls, focus management after async actions.
- Ensure transcript updates are screen-reader friendly.

### 10) Performance polish for long sessions
Status: Open
Scope:
- Virtualize transcript rendering for very long message lists.
- Add message windowing while preserving full-history server access.

### 11) Product analytics baseline
Status: Open
Scope:
- Add privacy-safe funnel events (session start, child join success/fail, turn send, nudge send, voice usage).
- Define baseline activation and retention metrics for iteration.

---

## Parking Lot (Not Scheduled)

- Multi-language tutoring support.
- COPPA consent/export/deletion self-serve parent portal UX.
- Native mobile wrapper once web UX stabilizes.
