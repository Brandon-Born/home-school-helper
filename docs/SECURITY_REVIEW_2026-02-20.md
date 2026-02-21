# Security Review - 2026-02-20

## Scope and method
- Reviewed all server API routes under `app/api/**`.
- Reviewed security-critical server modules under `src/server/**` (auth, rate limiting, session lifecycle, privacy, speech, telemetry).
- Reviewed database migrations and RLS under `supabase/migrations/*.sql`.
- Reviewed client token handling in parent/child hooks.
- Ran dependency vulnerability scan:
  - `npm audit --omit=dev --json`
  - `npm audit --json`
- Ran targeted security/auth/rate-limit/privacy tests:
  - `node --test tests/security.test.js tests/test-auth-bootstrap-route.test.js tests/session-auth-integration.test.js`
  - `node --test tests/rate-limit.test.js tests/speech-routes.test.js tests/privacy-delete-route.test.js tests/privacy-export-route.test.js`

## Summary
- Dependency scan result: no known npm vulnerabilities at scan time.
- Primary risk theme: authorization/session lifecycle hardening and abuse resistance (cost/DoS).
- Highest priority: fix fail-open consent behavior, enforce bounded inputs, and revoke child session capabilities when a session ends.

## Remediation Update (2026-02-21)
- Status: All nine findings below have been remediated in code and validated by targeted security test suites.
- Fix highlights:
  - COPPA fail-open protections now include production fail-closed behavior plus startup schema health validation (`scripts/validate-env.mjs`, `src/server/session-foundation/coppa-schema-health.js`).
  - Expensive-path payload caps and speech MIME/size validation are enforced with regression coverage (`app/api/session/[id]/child-turn/route.js`, `app/api/session/[id]/parent-nudge/route.js`, `src/server/speech-route-validators.js`).
  - Child token invalidation on session end plus active-session enforcement now blocks child access on ended sessions (including stream/messages child path via viewer resolver).
  - Unexpected server/internal error text is redacted from client envelopes; provider raw payload passthrough removed for Anthropic path.
  - Stream abuse controls added: connect rate limiting + concurrent stream caps + slot lifecycle telemetry.
  - Production rate-limit behavior now disallows silent fallback and tightens proxy-header trust defaults.
  - Hardened security headers added (CSP/HSTS/frame/referrer/content-type/permissions) and inline bootstrap script moved to static asset; nonce-based strict CSP follow-up is tracked in the product backlog.
  - Child session token persistence moved from `localStorage` to `sessionStorage` (intermediate hardening step; cookie migration tracked in product backlog).
  - Server telemetry now redacts freeform `error.message` by default (opt-in only via env).

## Findings

### 1) Fail-open COPPA consent behavior on schema mismatch
- Severity: High
- Impact: If COPPA columns/tables are missing in a deployed environment, consent checks can silently become `required=false` and `granted`, allowing child data collection/session starts without intended consent gating.
- Evidence:
  - `src/server/session-foundation/coppa-consent-service.js:115`
  - `src/server/session-foundation/coppa-consent-service.js:189`
  - `src/server/session-foundation/coppa-consent-service.js:219`
  - `src/server/auth.js:50`
- Mitigation:
  - Fail closed in non-local environments: treat schema mismatch as `500` and block child-data actions.
  - Gate fallback behind explicit dev-only flag (for example `ALLOW_COPPA_SCHEMA_FALLBACK=1`) and enforce `NODE_ENV !== "production"`.
  - Add startup health check that validates presence of COPPA schema objects before serving traffic.

### 2) Unbounded request payloads on expensive paths (cost/DoS)
- Severity: High
- Impact: Attackers with valid tokens can send oversized text/audio payloads, increasing model/provider costs and creating memory/latency pressure.
- Evidence:
  - `app/api/session/[id]/child-turn/route.js:27`
  - `app/api/session/[id]/parent-nudge/route.js:29`
  - `src/server/speech-route-validators.js:21`
  - `src/server/speech-route-validators.js:34`
- Mitigation:
  - Add strict max lengths:
    - `student_input` and `nudge_text` (for example 2-4 KB).
    - TTS text length (for example 1-2 KB after normalization).
    - Transcribe upload byte cap (for example 2-5 MB).
  - Reject non-audio MIME types for transcribe route.
  - Return `413 payload_too_large` (or `400 validation_error`) with consistent error codes.
  - Add tests for oversized payload rejection.

### 3) Child token capabilities persist after parent ends session
- Severity: High
- Impact: Ending a session does not revoke issued child tokens. Speech routes authorize only by token validity, so a child token can continue invoking speech APIs until token expiry.
- Evidence:
  - Session end path has no child token revocation:
    - `src/server/session-foundation/session-service.js:281`
  - Child token validation checks only token/session hash+expiry:
    - `src/server/auth.js:87`
  - Speech routes only call `requireChildSessionContext` and do not assert session status is active:
    - `app/api/session/[id]/speech/transcribe/route.js:36`
    - `app/api/session/[id]/speech/synthesize/route.js:36`
- Mitigation:
  - On session end, revoke all active child tokens for that session (`revoked_at=now()`).
  - Enforce active session check in speech routes (or centralize in child context helper).
  - Consider shortening child token TTL and rotating/revoking on manage actions.
  - Add regression tests: ended session token should fail on transcribe/synthesize/messages/stream as intended policy dictates.

### 4) Internal error details are returned directly to clients
- Severity: Medium
- Impact: Raw internal/provider errors can leak implementation details, upstream responses, and operational internals to clients.
- Evidence:
  - Generic route error passthrough:
    - `src/server/route-errors.js:9`
  - Anthropic error includes response body text:
    - `src/server/anthropic.js:45`
  - Stream route directly emits exception messages:
    - `app/api/session/[id]/stream/route.js:29`
- Mitigation:
  - Return generic user-facing error messages for `5xx`.
  - Keep detailed diagnostics in server logs only (with redaction).
  - Map upstream/provider errors to stable internal codes without echoing raw provider payloads.

### 5) Stream endpoint lacks abuse controls for long-lived connections
- Severity: Medium
- Impact: Authenticated users can open many concurrent SSE streams; no per-token/session cap or stream-specific throttling is enforced.
- Evidence:
  - Stream route has no call to `enforceRateLimit`:
    - `app/api/session/[id]/stream/route.js:21`
- Mitigation:
  - Add stream connection policy:
    - rate limit connect attempts,
    - max concurrent streams per token/session/IP,
    - early close on abusive reconnect loops.
  - Emit structured metrics for concurrent stream counts and connection churn.

### 6) Rate limiting can degrade and be bypassed depending on headers/deployment
- Severity: Medium
- Impact:
  - In `auto` mode, distributed limiter failures silently fall back to in-memory per-instance limits.
  - Client IP is derived from forwarded headers that may be spoofable outside trusted proxy setups.
- Evidence:
  - Header-derived IP:
    - `src/server/rate-limit.js:20`
  - Fallback to in-memory on distributed errors:
    - `src/server/rate-limit.js:163`
- Mitigation:
  - In production, force `RATE_LIMIT_BACKEND=supabase` (fail closed if backend unavailable).
  - Trust proxy headers only from known infrastructure; otherwise derive IP from trusted platform APIs.
  - Add alerting when fallback occurs.

### 7) Missing hardened response security headers
- Severity: Medium
- Impact: App currently relies on defaults and does not set explicit CSP/HSTS/frame protections. This weakens defense-in-depth against XSS/clickjacking/mixed-content downgrade risks.
- Evidence:
  - Minimal Next config only disables `x-powered-by`:
    - `next.config.mjs:2`
  - Inline script exists in layout:
    - `app/layout.js:20`
- Mitigation:
  - Add headers middleware/config for:
    - `Content-Security-Policy` (nonce/hash for inline bootstrap script),
    - `Strict-Transport-Security`,
    - `X-Frame-Options` or CSP `frame-ancestors`,
    - `Referrer-Policy`,
    - `X-Content-Type-Options`.
  - Prefer nonce-based inline script handling or move bootstrap logic to non-inline path compatible with strict CSP.

### 8) Child session token persisted in localStorage
- Severity: Medium
- Impact: Any XSS on child surface can exfiltrate active child tokens (bearer tokens), enabling unauthorized API use during token lifetime.
- Evidence:
  - Load/store token from localStorage:
    - `app/child/hooks/useChildConsole.js:193`
    - `app/child/hooks/useChildConsole.js:268`
- Mitigation:
  - Prefer `sessionStorage` (shorter persistence) at minimum.
  - Ideally move to server-managed HttpOnly session cookies for child session.
  - Tighten CSP and sanitize all render paths to reduce XSS likelihood.

### 9) Telemetry/logging captures raw error messages
- Severity: Low-Medium
- Impact: Provider/internal error text may include sensitive request context and can end up in centralized logs.
- Evidence:
  - Error message field copied directly:
    - `src/server/voice-telemetry.js:30`
    - `src/server/stream-telemetry.js:27`
  - Routes pass these details into telemetry events:
    - `app/api/session/[id]/speech/transcribe/route.js:52`
    - `app/api/session/[id]/speech/synthesize/route.js:58`
    - `app/api/session/[id]/stream/route.js:33`
- Mitigation:
  - Redact/suppress freeform `error.message` by default.
  - Log only controlled error codes/status fields in production.
  - Add a privacy log policy and automated checks for sensitive fields.

## Prioritized mitigation plan

### Priority 0 (immediate)
- Fail closed on COPPA schema mismatch in non-dev environments.
- Revoke child tokens at session end and enforce active session checks in speech routes.
- Add payload size limits for child-turn, parent-nudge, speech transcribe, and speech synthesize.

### Priority 1 (next sprint)
- Replace raw internal error passthrough with safe client error envelopes.
- Add stream abuse controls (connect throttle + concurrent cap).
- Enforce strict distributed rate limiting in production with no silent fallback.

### Priority 2 (hardening)
- Introduce full security header policy with CSP + HSTS + frame protections.
- Reduce token exposure surface (localStorage to sessionStorage/cookie strategy).
- Redact error messages in telemetry logs.

## Validation checklist after fixes
- Add/extend unit tests for:
  - COPPA fail-closed behavior,
  - token revocation on session end,
  - speech routes rejecting ended sessions,
  - payload-size validation failures.
- Add integration tests for stream abuse controls and rate-limit behavior in production mode.
- Re-run:
  - `npm audit --json`
  - targeted security test suites
  - full CI test matrix.
