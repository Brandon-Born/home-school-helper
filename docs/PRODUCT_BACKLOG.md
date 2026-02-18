# Product Backlog (Rolling Open Items)

Last updated: 2026-02-18

Purpose:
- Capture high-impact product and engineering improvements beyond the current "working" baseline.
- Keep a single rolling queue of open items only.

How to use:
1. Start with the highest-priority open item.
2. If you change behavior, update `docs/API_CONTRACT.md` and related docs in the same PR.
3. When an item is done, remove it from this file and summarize completion in `docs/handoffs/HANDOFF_LOG.md`.

---

## P0 (Highest Impact)

- None currently open.

---

## P1 (High Value)

### 19) Split child voice capture by transport strategy
Status: Open
Problem:
- `app/child/hooks/voice/useChildVoiceCapture.js` still mixes cloud STT recorder flow and browser speech-recognition flow in one state machine.
Scope:
- Extract cloud and browser capture flows into strategy-specific hooks/modules.
- Keep `useChildVoiceCapture` as a thin chooser/orchestrator over those strategies.
- Add focused tests per strategy for transitions and failures.
Success metric:
- Voice capture code paths become easier to reason about, debug, and evolve independently.

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

### 20) Consolidate async action status boilerplate
Status: Open
Problem:
- Parent action handlers repeat loading toggles, try/catch wrappers, and scoped success/error alert updates, which increases drift risk.
Scope:
- Introduce a shared helper/reducer pattern for async action lifecycle (`pending`, `success`, `error`) with message support.
- Apply pattern across parent child/session/nudge/override actions.
- Add focused tests for helper behavior.
Success metric:
- Less duplicated status code and more consistent UX behavior across parent actions.

### 21) Migrate hook tests off `react-test-renderer`
Status: Open
Problem:
- Hook tests currently rely on `react-test-renderer`, which emits React 19 deprecation warnings and raises maintenance risk.
Scope:
- Migrate hook tests to a supported test harness while preserving current coverage depth.
- Remove deprecated renderer dependency from dev tooling.
Success metric:
- Hook test suite runs without deprecation noise and remains stable on future React upgrades.

---

## Parking Lot (Not Scheduled)

- Multi-language tutoring support.
- COPPA consent/export/deletion self-serve parent portal UX.
- Native mobile wrapper once web UX stabilizes.
