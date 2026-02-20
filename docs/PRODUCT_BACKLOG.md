# Product Backlog (Rolling Open Items)

Last updated: 2026-02-20

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

### 19) Tutor memory semantic distillation (low-lift, high impact)
Status: Open
Why:
- Current rolling `session_memory` is deterministic and bounded; it is robust but can lose nuance over long or branching sessions.
- A lightweight periodic semantic distillation step should improve continuity without requiring full-history prompts.
Scope:
- Add optional distillation pass every `N` turns (recommend default `N=8`) to refresh `session_memory.summary`.
- Use existing Anthropic server path with a tightly-scoped distillation prompt (no direct child output, memory-only artifact).
- Preserve deterministic memory pipeline as fallback when distillation is disabled or fails.
- Persist metadata in memory payload (for example `summary_kind`, `distilled_at`, `distill_turn`).
- Add env flags:
- `TUTOR_MEMORY_DISTILL_ENABLED` (`0|1`, default `0`)
- `TUTOR_MEMORY_DISTILL_EVERY_TURNS` (default `8`, min `4`, max `20`)
Implementation notes (starter files):
- `src/server/session-foundation/session-memory-service.js`
- `src/server/session-turn-orchestrator.js`
- `src/server/tutor-service.js`
- `src/server/config.js` (for env parsing)
- `tests/session-memory-service.test.js`
- `tests/session-turn-orchestrator.test.js`
Definition of done:
- Distillation runs only on schedule and never blocks tutor response path on failure.
- Memory schema remains backward-compatible with existing sessions.
- Unit/integration coverage verifies scheduling, persistence, fallback behavior, and idempotency.
Validation:
- `node --test tests/session-memory-service.test.js tests/session-turn-orchestrator.test.js tests/tutor-service.test.js`
- `node --test tests/e2e-critical-path.test.js`

### 20) Tutor quality eval harness + CI regression gate
Status: Open
Why:
- We need objective quality tracking for core tutor behavior (scaffold style, safety, non-robotic flow, scope control) before production scale.
Scope:
- Add an offline eval harness with curated fixtures (target 75-150 turn cases initially).
- Score dimensions:
- repetition/robotic phrasing
- direct-answer policy compliance
- parent-guidance leakage
- topic drift/out-of-scope behavior
- unsafe-content handling
- Output machine-readable results (`json`) plus human summary (`markdown`).
- Add CI threshold gating with baseline file in repo.
Implementation notes (starter files):
- `scripts/` (new runner, for example `scripts/eval-tutor-quality.mjs`)
- `tests/fixtures/` (new eval fixture set)
- `.github/workflows/` (CI integration)
- `src/server/tutor-service.js` and `src/server/guardrails.js` for instrumentation hooks
Definition of done:
- Harness runs locally and in CI with deterministic output for identical input/config.
- Baseline scores are committed and compared on PRs.
- CI fails when critical dimensions regress beyond thresholds.
Validation:
- `node scripts/eval-tutor-quality.mjs --update-baseline`
- `node scripts/eval-tutor-quality.mjs --check`

### 21) Prompt/context health telemetry and failure counters
Status: Open
Why:
- We currently lack production-grade observability on prompt size pressure and memory-update reliability.
Scope:
- Emit structured metrics for:
- prompt-context size (`recent_messages_count`, `memory_checkpoint_count`, estimated prompt chars/tokens)
- memory update outcomes (`success`, `failure`, fallback usage)
- guardrail rewrite rate by route/source
- Add a low-noise aggregation format compatible with existing server telemetry logs.
- Update docs with metric definitions and interpretation guidance.
Implementation notes (starter files):
- `src/server/tutor-service.js`
- `src/server/session-turn-orchestrator.js`
- `src/server/session-foundation/session-memory-service.js`
- `docs/ANALYTICS_BASELINE.md`
- `docs/API_CONTRACT.md`
Definition of done:
- Metrics are emitted for both child-turn and parent-nudge flows.
- Failures are observable without leaking sensitive payload text.
- Unit tests cover metric emission for success/failure paths.
Validation:
- `node --test tests/tutor-service.test.js tests/session-turn-orchestrator.test.js tests/security.test.js`

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

### 22) Tutor quality operations loop (alerts + weekly review pack)
Status: Open
Why:
- Evaluation and telemetry only create value if we review them consistently and act on regressions.
Scope:
- Create a weekly report workflow that summarizes:
- eval score trends
- guardrail rewrite/failure trends
- top repeated response patterns
- Define alert thresholds and owners for core quality regressions.
- Add a short runbook for response steps when thresholds breach.
Implementation notes (starter files):
- `docs/ANALYTICS_BASELINE.md`
- `docs/README.md` (link to runbook/report)
- `.github/workflows/` (scheduled report generation, if desired)
Definition of done:
- Standard weekly report can be generated from repo artifacts/log exports.
- Alert thresholds are documented and testable.
- Clear owner/action path exists for each alert class.
Validation:
- Run report generation command locally and attach sample output in handoff.

---

## Parking Lot (Not Scheduled)

- Multi-language tutoring support.
- COPPA parent-rights self-serve UX (data summary/export/deletion hardening) (implementation notes: `docs/COPPA_LAUNCH_PLAN.md`).
- Native mobile wrapper once web UX stabilizes.
