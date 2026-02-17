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
- Google Speech (enables cloud STT/TTS for child voice loop):
  - `SPEECH_PROVIDER` (default: `google`)
  - `GOOGLE_CLOUD_PROJECT_ID`
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_CLOUD_LOCATION` (default: `global`)
  - `GOOGLE_STT_RECOGNIZER` (default: `_`)
  - `GOOGLE_STT_LANGUAGE_CODE` (default: `en-US`)
  - `GOOGLE_STT_MODEL` (default: `chirp_2`)
  - `GOOGLE_TTS_LANGUAGE_CODE` (default: `en-US`)
  - `GOOGLE_TTS_VOICE_NAME` (default: `en-US-Chirp3-HD-Achernar`)
  - `GOOGLE_TTS_AUDIO_ENCODING` (default: `MP3`)
  - `GOOGLE_TTS_SPEAKING_RATE` (default: `1.0`)

## API Routes
- `GET /api/parent/me` (parent bearer token required)
- `GET /api/children` (parent bearer token required)
- `POST /api/children` (parent bearer token required)
- `POST /api/session/start` (parent bearer token required)
- `POST /api/session/join` (one-time code redemption)
- `POST /api/session/:id/child-turn`
- `POST /api/session/:id/parent-nudge`
- `GET /api/session/:id/messages`
- `GET /api/session/:id/stream` (SSE subscription)
- `POST /api/session/:id/override`
- `POST /api/session/:id/speech/transcribe` (child bearer token required)
- `POST /api/session/:id/speech/synthesize` (child bearer token required)

## UI Routes
- `/parent` parent onboarding/session console
- `/child` child join + tutor chat
- `/auth/callback` OAuth callback completion

## Commands
- `npm run dev`
- `npm run build`
- `npm run check:env`
- `npm run check:handoff`
- `npm test`
