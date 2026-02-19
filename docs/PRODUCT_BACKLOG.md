# Product Backlog (Rolling Open Items)

Last updated: 2026-02-19

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

- None currently open.

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
- COPPA consent/export/deletion self-serve parent portal UX (implementation notes: `docs/COPPA_LAUNCH_PLAN.md`).
- Native mobile wrapper once web UX stabilizes.
