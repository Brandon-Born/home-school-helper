# Homeschool Sidekick

A web-based tutoring assistant for homeschool students. Parents set up lessons and steer the AI tutor in real time — children interact through a simple chat (with optional voice). The tutor defaults to **scaffold-first guidance**, giving hints and questions before answers.

## How It Works

```
Parent                         Server                        Child
──────                         ──────                        ─────
Sign in (Google) ──────────▸ Create session
                              Generate join code ──────────▸ Enter code
                                                            Ask a question
                              Anthropic API call ◂─────────
                              Guardrail check
                              ──────────────────────────────▸ Tutor response
Send private nudge ──────▸ Adjust tutor behavior
                              (child never sees nudge)
```

**Key idea:** Parents guide from the sidelines. The child sees a friendly tutor. The parent sees everything and can nudge the tutor's behavior without the child knowing.

## Quick Start

```bash
cp .env.example .env       # Fill in required keys (see below)
npm install
npm run dev                # http://localhost:3000
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Tutoring model API key |
| `ANTHROPIC_MODEL` | Model to use (e.g. `claude-sonnet-4-5-20250929`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |

Optional variables for Anthropic tuning (`ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_TEMPERATURE`, `TUTOR_SYSTEM_PROMPT_VERSION`), stream telemetry/transport (`STREAM_TELEMETRY_DISABLED`, `NEXT_PUBLIC_STREAM_TELEMETRY_DISABLED`, `STREAM_TRANSPORT_MODE`), voice telemetry (`SPEECH_TELEMETRY_DISABLED`, `NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED`), product analytics telemetry (`PRODUCT_ANALYTICS_DISABLED`, `NEXT_PUBLIC_PRODUCT_ANALYTICS_DISABLED`), and Google Speech integration are documented in `.env.example`.

COPPA consent controls are configurable via optional env vars:
- `COPPA_CONSENT_REQUIRED` (`1` default, set `0` for local/dev fallback environments).
- `COPPA_POLICY_VERSION` (recorded in consent audit events).
- `COPPA_POLICY_URL` (returned in consent API payloads).

For non-interactive Playwright auth in local/test, configure:
- `ENABLE_TEST_AUTH_BOOTSTRAP=1`
- `PLAYWRIGHT_TEST_AUTH_SECRET=<shared secret for setup + route header>`
- `PLAYWRIGHT_TEST_AUTH_EMAIL=<test parent account email>`

## Project Structure

```
app/
├── page.js                    Landing page
├── parent/                    Parent console with sectioned workspace (Children/Sessions/Managed)
├── child/                     Child join + tutor chat
├── auth/callback/             OAuth callback
├── api/                       API routes (see below)
├── components/                Shared UI (AppShell, forms, transcript, theme)
└── styles/                    Design system (tokens, base, layout, components, motion)

src/server/                    Server-side logic
├── session-foundation/        Core services (children, sessions, messages, policies)
├── tutor/                     Anthropic integration + prompt assembly
├── speech/                    Google STT/TTS integration
└── *.js                       Auth, rate limiting, error handling

docs/                          Architecture, API contract, DB schema, security
tests/                         Unit tests
```

## API Routes

### Auth & Profiles
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/parent/me` | Parent | Get/sync parent profile |
| GET | `/api/privacy/consent` | Parent | Get parent consent checkpoint state |
| POST | `/api/privacy/consent` | Parent | Revoke parent consent checkpoint (direct grant is blocked when billing-backed verification is required) |
| GET | `/api/billing/subscription` | Parent | Get normalized billing subscription state |
| POST | `/api/billing/verification-session` | Parent | Legacy/deprecated: separate parent payment verification checkout (older 2-step flow) |
| POST | `/api/billing/checkout-session` | Parent | Create Stripe Checkout session URL for family subscription signup (single-step flow) |
| POST | `/api/billing/portal-session` | Parent | Create Stripe Billing Portal session URL |
| POST | `/api/billing/webhook` | Stripe | Process Stripe billing webhooks (paid signup consent + subscription lifecycle sync) |
| GET | `/api/privacy/child-data-summary` | Parent | Get aggregate child-data category summary |
| GET | `/api/privacy/requests` | Parent | List recent privacy export/delete requests |
| POST | `/api/privacy/export` | Parent | Generate a child-data export snapshot |
| POST | `/api/privacy/delete` | Parent | Delete all child profile/session/transcript data (confirmed) |
| GET | `/api/children` | Parent | List children |
| POST | `/api/children` | Parent | Create child profile |
| PUT | `/api/children/:id` | Parent | Update child profile |
| DELETE | `/api/children/:id` | Parent | Delete child (blocked if active session) |

### Sessions
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/session/start` | Parent | Start session, get join code (requires consent and active/trialing subscription when billing is enabled) |
| GET | `/api/session/active` | Parent | List active sessions |
| POST | `/api/session/join` | Code | Redeem join code, get child token |
| POST | `/api/session/:id/child-turn` | Child | Submit tutoring turn |
| POST | `/api/session/:id/parent-nudge` | Parent | Send hidden guidance to tutor |
| GET | `/api/session/:id/messages` | Both | Fetch transcript |
| GET | `/api/session/:id/stream` | Both | SSE transcript stream |
| POST | `/api/session/:id/override` | Parent | Toggle direct-answer mode |
| POST | `/api/session/:id/manage` | Parent | End session or regenerate join code |

### Speech (optional, requires Google Cloud config)
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/session/:id/speech/transcribe` | Child | Speech-to-text |
| POST | `/api/session/:id/speech/synthesize` | Child | Text-to-speech |

### Analytics (privacy-safe baseline)
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/analytics/event` | Public | Capture allowlisted funnel events (no transcript/audio content) |

Full request/response shapes: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)

`POST /api/session/:id/child-turn` now returns persisted `input_message` and `assistant_message` rows inline so clients can render and speak immediately, without waiting for stream polling.

## UI Routes

| Route | Who | What |
|-------|-----|------|
| `/` | Everyone | Landing page with parent/child entry points |
| `/parent` | Parents | Command center with left section nav (`Children`, `Sessions`, `Managed`) |
| `/child` | Children | Enter join code → chat with tutor |
| `/auth/callback` | System | OAuth completion redirect |

## Safety & Design Principles

- **Scaffold-first tutoring** — hints and guiding questions before direct answers
- **Parent steering is invisible** — children never see nudges or parent context
- **Consent before collection** — child profile creation and new session start require granted parent consent
- **Secrets stay server-side** — no API keys in browser code, ever
- **Guardrails always on** — unsafe content blocked even when direct-answer mode is enabled
- **Anthropic-only** — single LLM provider in v1 for auditability

Full security docs: [`docs/SECURITY_AND_COMPLIANCE.md`](docs/SECURITY_AND_COMPLIANCE.md)

## Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm test              # Run unit + Playwright e2e tests
npm run test:unit     # Run unit tests only
npm run test:e2e      # Run Playwright e2e tests only
npm run check:env     # Validate environment variables
npm run check:handoff # Validate handoff log
```

Note: use `npm run test:e2e` (or `node scripts/run-playwright.mjs ...`) instead of `npx playwright test` in this repo. The wrapper runs Playwright against an isolated app origin so auth-bootstrap storage state matches the server under test.

## Playwright Auth Bootstrap (Test-Only)

To avoid manual Google OAuth during Playwright runs:

1. Set `.env` values:
   - `ENABLE_TEST_AUTH_BOOTSTRAP=1`
   - `PLAYWRIGHT_TEST_AUTH_SECRET=...`
   - `PLAYWRIGHT_TEST_AUTH_EMAIL=playwright-parent@example.test`
2. Run `npm run test:e2e` (or `npm test`).

If you run `npx playwright test` directly, the auth bootstrap state may be written for a different origin than the app server Playwright launches, which can cause misleading `Signed in as` / parent-auth bootstrap failures.

`tests/playwright/global.setup.mjs` calls `POST /api/test-auth/bootstrap`, opens the one-time admin-generated link in Chromium, and writes `tests/playwright/.auth/parent.json` for re-use by all Playwright tests.
Playwright starts the app server automatically through `playwright.config.mjs` `webServer` settings.

## Documentation Index

| Doc | What it covers |
|-----|----------------|
| [`docs/START_HERE.md`](docs/START_HERE.md) | Onboarding — read order and current priorities |
| [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) | Roadmap and phase breakdown |
| [`docs/PRODUCT_BACKLOG.md`](docs/PRODUCT_BACKLOG.md) | Prioritized future improvements and TODO queue |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Full API request/response specs |
| [`docs/DB_SCHEMA_AND_RLS.md`](docs/DB_SCHEMA_AND_RLS.md) | Database tables and row-level security |
| [`docs/IMPLEMENTATION_SPEC.md`](docs/IMPLEMENTATION_SPEC.md) | Architecture decisions |
| [`docs/SECURITY_AND_COMPLIANCE.md`](docs/SECURITY_AND_COMPLIANCE.md) | Safety, privacy, compliance |
| [`docs/COPPA_LAUNCH_PLAN.md`](docs/COPPA_LAUNCH_PLAN.md) | Deferred COPPA implementation plan and launch checklist |
| [`docs/ANALYTICS_BASELINE.md`](docs/ANALYTICS_BASELINE.md) | Privacy-safe event baseline and activation/retention metric definitions |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Vercel deployment guide |
| [`AGENT.md`](AGENT.md) | Agent operating contract and guardrail policy |

## Theme

System-aware dark/light mode with user override (`System` / `Light` / `Dark`). Preference persists in `localStorage` under `hsh_theme_mode`. Design uses Inter (body) + Outfit (display) with an indigo/purple palette and teal/coral role accents.

## Legal

© 2026 Freyr And Sons LLC. All rights reserved.
