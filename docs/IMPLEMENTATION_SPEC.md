# Implementation Spec (v1)

## Scope
This spec covers the first production-capable version of the homeschool tutor web app with:
- Parent Google login and onboarding.
- Child join by short-lived one-time session code.
- Hidden parent steering channel.
- Scaffold-first tutoring through Anthropic server calls.

## Architecture
- Frontend: Next.js App Router on Vercel.
- Data/realtime/auth: Supabase Postgres + Realtime + Auth.
- LLM: Anthropic only, server-side calls only.
- Secret management: Vercel env vars.

## Core Flows
1. Parent onboarding
- Parent signs in with Google.
- Parent creates child profile (name, age, grade, subjects, notes, special needs).
- System stores a child tutoring profile payload.

2. Session start
- Parent selects child and enters daily context.
- System creates a session record and one-time join code (10-minute TTL).

3. Child join
- Child enters join code.
- System validates code state and issues a scoped child session token.

4. Live tutoring
- Child sends voice-transcribed or typed messages.
- Parent can send hidden nudge text.
- Tutor pipeline calls Anthropic and enforces guardrails before response.

## Server Modules
- `src/server/config.js`: typed env parsing/validation.
- `src/server/anthropic.js`: Anthropic messages API wrapper.
- `src/server/guardrails.js`: scaffold-first and unsafe-content policy.
- `src/server/tutor-service.js`: shared orchestration for child turn and parent nudge.

## Guardrail Rules
- Default: no direct answers.
- Override: direct answers allowed only when explicit parent override is active.
- Unsafe content: always blocked regardless of override.
- Hidden guidance: parent text is private context, never displayed verbatim to child.

## Realtime Event Targets
- `session.transcript.append`
- `session.tutor.speak`
- `session.parent.nudge.received`
- `session.policy.alert`
- `session.state.changed`

## Acceptance Criteria
- Child-turn endpoint returns: `assistant_text`, `speak_payload`, `policy_applied`, `model_used`.
- Parent nudge endpoint uses same tutor pipeline and queues tutor utterance.
- Required env vars fail startup when missing.
- CI enforces handoff log update when runtime code changes.

## Out Of Scope (Current)
- Multi-provider model routing.
- Native mobile app.
- Multi-language tutoring.
