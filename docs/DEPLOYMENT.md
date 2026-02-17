# Deployment Guide (Vercel)

## Environments
- Local development
- Vercel Preview
- Vercel Production

## Required Environment Variables
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`

## Optional Environment Variables
- `ANTHROPIC_MAX_TOKENS` (default `512`)
- `ANTHROPIC_TEMPERATURE` (default `0.3`)
- `TUTOR_SYSTEM_PROMPT_VERSION` (default `v1`)

## Vercel Setup
1. Connect GitHub repository to Vercel project.
2. Add environment variables for Preview and Production.
3. Deploy `main` to Production after CI passes.

## Build/Runtime Checks
- `prestart` runs env validation (`scripts/validate-env.mjs`).
- CI runs:
  - `npm test`
  - `npm run check:handoff`

## Rollout Procedure
1. Merge PR to `main` after CI success.
2. Verify health checks and API route responses in Preview.
3. Promote to Production.
4. Verify tutor call logs include expected `model_used` and prompt version.

## Rollback Procedure
1. Revert to prior successful deployment in Vercel dashboard.
2. If model-side issue, set safer model or lower temperature via env vars.
3. Confirm routes respond and guardrail policy events normalize.

## Operational Notes
- Do not store `.env` in repo.
- Never expose `ANTHROPIC_API_KEY` to client bundles.
- Any env-var contract changes require updates to `.env.example` and README.
