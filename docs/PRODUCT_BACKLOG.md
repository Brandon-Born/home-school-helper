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

### 14) Parent/child console orchestration refactor
Status: Open
Scope:
- Decompose `useParentConsole` and `useChildConsole` orchestration into clearer state domains (or reducer/state-machine boundaries).
- Reduce cross-cutting side effects and tighten testability of async/session transitions.

### 15) Transcript feed logic split
Status: Open
Scope:
- Extract transcript windowing/state behavior from `TranscriptFeed` into a focused hook (for example `useTranscriptWindowing`).
- Keep accessibility live-region behavior isolated and regression-tested independently.

### 16) Voice strategy telemetry/error unification
Status: Open
Scope:
- Consolidate duplicated analytics/telemetry/error mapping patterns across cloud and browser voice capture strategies.
- Preserve transport-specific behavior while centralizing shared event/status handling.

### 17) Shared env-loader utility for scripts
Status: Open
Scope:
- Replace duplicated `.env` parsing/loading logic in script entrypoints with one shared utility.
- Ensure script behavior stays deterministic across local and CI runs.

### 18) Playwright runtime env normalization cleanup
Status: Open
Scope:
- Remove remaining `NO_COLOR`/`FORCE_COLOR` warning noise by normalizing env propagation across Playwright + webServer subprocesses.
- Keep logs clean without altering test behavior.

---

## P2 (Quality / Delight)

- None currently open.

---

## Parking Lot (Not Scheduled)

- Multi-language tutoring support.
- COPPA consent/export/deletion self-serve parent portal UX (implementation notes: `docs/COPPA_LAUNCH_PLAN.md`).
- Native mobile wrapper once web UX stabilizes.
