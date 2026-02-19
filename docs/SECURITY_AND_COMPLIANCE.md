# Security And Compliance (COPPA-First)

## Compliance Posture
This project is designed with COPPA-first defaults for U.S. minors.

## Data Classification
- High sensitivity: child profile notes, session transcripts, parent guidance.
- Secret: API keys and service-role credentials.
- Low sensitivity: non-identifying UI preferences.

## Required Controls
1. Consent and access
- Parent must authenticate before creating child profiles.
- Child joins by parent-issued code only.

2. Data minimization
- No raw audio storage in v1.
- Retain transcript text for 30 days by default, then auto-delete.
  - Implemented with DB function `public.purge_expired_messages(30)` and daily `pg_cron` schedule (`purge-expired-messages`).

3. Secret handling
- Anthropic key only in server runtime env vars.
- Never render or return secrets in client responses.

4. Guardrails
- Scaffold-first pedagogy default.
- Unsafe content blocked in all modes.
- Direct answer mode requires explicit parent override.

5. Auditing
- Log model name and prompt version per tutor request.
- Log policy actions (`scaffold_rewrite`, `unsafe_content_blocked`, etc.).

6. Product analytics minimization
- Allow only privacy-safe funnel events with bounded payloads.
- Never ingest child transcript content or raw audio in analytics events.

## Threat Model (Initial)
- Prompt injection via child or parent text.
Mitigation: fixed system policy layers + output guardrails.

- Unauthorized child session join.
Mitigation: one-time short-lived session code + rate limiting.

- Hidden channel leakage.
Mitigation: message visibility scope and API-level filtering.

- Secret leakage in frontend.
Mitigation: server-only LLM module and env validation.

## Incident Response
1. Disable affected route/feature flag.
2. Rotate compromised keys.
3. Snapshot and review relevant audit records.
4. Patch guardrails/policies.
5. Document in decisions log and handoff log.

## Open Compliance Work
- COPPA consent/export/deletion implementation is tracked in `/Users/bborn/home-school-helper/docs/COPPA_LAUNCH_PLAN.md` and must be completed before production launch.
- Legal review and provider written-assurance signoff are required before production launch.
- Configure `RATE_LIMIT_BACKEND=supabase` in deployed environments to require shared/global limits; keep `auto` only for local/dev fallback.
