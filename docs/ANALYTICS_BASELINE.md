# Product Analytics Baseline (Privacy-Safe)

Last updated: 2026-02-19

## Purpose
- Define a minimal event baseline for product iteration without collecting child content.
- Keep instrumentation operationally simple and safe for COPPA-first architecture.

## Event Baseline
Tracked event names:
- `session_start` (`success` | `failed`)
- `child_join` (`success` | `failed`)
- `turn_send` (`success` | `failed`)
- `nudge_send` (`success` | `failed`)
- `voice_usage` (`started` | `transcribed` | `failed` | `permission_denied`)

Data minimization rules:
- Do not log transcript message text.
- Do not log raw audio.
- Do not log child names, join codes, or free-form parent/child input.
- Keep payloads to event status + bounded operational metadata only.

Current ingestion:
- Client sends events to `POST /api/analytics/event`.
- Server validates allowlisted events/payload fields and writes structured server logs (`[product-analytics]`).

## Activation Metrics
Parent activation (D0):
- Definition: parent records at least one `session_start` with `status=success` on day of first sign-in.

Child activation (session-level):
- Definition: session has both:
  1. `child_join` with `status=success`
  2. `turn_send` with `status=success`

Voice activation:
- Definition: session has `voice_usage` with `status=transcribed`.

## Retention Metrics
Parent week-1 retention:
- Definition: parent with `session_start:success` in week N and again in week N+1.

Session continuation signal:
- Definition: session has 2+ successful turns (`turn_send:success` count >= 2).

Voice retention signal:
- Definition: parent or household has `voice_usage:transcribed` in 2+ distinct weeks.

## Suggested Reporting Views
1. Funnel conversion:
   - `session_start:success` -> `child_join:success` -> `turn_send:success`
2. Failure distribution:
   - `session_start:failed`, `child_join:failed`, `turn_send:failed`, `voice_usage:failed`
3. Voice adoption:
   - sessions with any `voice_usage:started`
   - sessions with `voice_usage:transcribed`

## Notes
- This baseline is intentionally lightweight and log-based.
- If centralized analytics storage is added later, keep the same allowlist + minimization constraints.
