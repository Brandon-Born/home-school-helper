# Home School Helper

Web-first homeschool tutoring assistant with parent steering and scaffold-first guardrails.

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
