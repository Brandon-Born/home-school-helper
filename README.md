# Home School Helper

Web-first homeschool tutoring assistant with parent steering and scaffold-first guardrails.

## Core Documentation
- Full docs index: `/Users/bborn/home-school-helper/docs/README.md`
- Start Here (new agent onboarding): `/Users/bborn/home-school-helper/docs/START_HERE.md`
- Project Plan: `/Users/bborn/home-school-helper/docs/PROJECT_PLAN.md`
- Agent Operating Contract: `/Users/bborn/home-school-helper/AGENT.md`
- Handoff Log: `/Users/bborn/home-school-helper/docs/handoffs/HANDOFF_LOG.md`
- Implementation Spec: `/Users/bborn/home-school-helper/docs/IMPLEMENTATION_SPEC.md`
- API Contract: `/Users/bborn/home-school-helper/docs/API_CONTRACT.md`
- DB Schema + RLS: `/Users/bborn/home-school-helper/docs/DB_SCHEMA_AND_RLS.md`
- Security + Compliance: `/Users/bborn/home-school-helper/docs/SECURITY_AND_COMPLIANCE.md`
- Deployment: `/Users/bborn/home-school-helper/docs/DEPLOYMENT.md`

## Required Environment Variables
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`

## Optional Environment Variables
- `ANTHROPIC_MAX_TOKENS` (default: `512`)
- `ANTHROPIC_TEMPERATURE` (default: `0.3`)
- `TUTOR_SYSTEM_PROMPT_VERSION` (default: `v1`)

## API Routes
- `POST /api/session/:id/child-turn`
- `POST /api/session/:id/parent-nudge`

## Commands
- `npm run dev`
- `npm run build`
- `npm run check:env`
- `npm run check:handoff`
- `npm test`
