# Product Backlog (Rolling Open Items)

Last updated: 2026-02-25

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

### 23) Distributed stream connection guard + lifecycle cleanup refactor
Status: Open
Why:
- Current stream concurrency protection is process-local and can drift under horizontal scale or server restarts.
- Stream connection acquire/release logic is currently coupled to route flow and should be centralized for easier reliability testing.
Scope:
- Move stream connection slot tracking from in-memory maps to a distributed backend (Supabase/Redis) with atomic acquire/release.
- Add lease/TTL cleanup for orphaned connections (disconnect races, worker restarts).
- Consolidate stream lifecycle hooks (connect, abort, runtime close, release telemetry) into one shared utility.
- Keep existing route-level behavior and telemetry contracts stable.
Implementation notes (starter files):
- `src/server/stream-connection-guard.js`
- `app/api/session/[id]/stream/route.js`
- `src/server/rate-limit.js`
- `tests/stream-route.test.js`
- `tests/rate-limit.test.js`
Definition of done:
- Concurrent stream limits hold across multiple app instances.
- No leaked active-slot records after abrupt disconnect/restart scenarios.
- Unit/integration coverage validates acquire/release correctness and orphan cleanup paths.
Validation:
- `node --test tests/stream-route.test.js tests/rate-limit.test.js tests/transcript-stream-runtime-telemetry.test.js`

### 24) Child session auth migration to HttpOnly cookies
Status: Open
Why:
- Child session tokens are now reduced to `sessionStorage`, but they are still readable by injected JS on the child surface.
- Moving to server-managed HttpOnly cookies meaningfully reduces token-exfiltration risk if client-side XSS occurs.
Scope:
- Replace bearer token storage/transport in child hooks with secure, short-lived HttpOnly session cookies.
- Update join/session bootstrap to set/rotate/revoke child cookies server-side.
- Keep child auth failure semantics and UX messaging unchanged.
- Add CSRF-safe request strategy for child routes where needed.
Implementation notes (starter files):
- `app/child/hooks/useChildConsole.js`
- `app/api/session/join/route.js`
- `src/server/auth.js`
- `app/api/session/[id]/child-turn/route.js`
- `app/api/session/[id]/messages/route.js`
- `app/api/session/[id]/stream/route.js`
- `tests/use-child-console-hook.test.js`
- `tests/session-auth-integration.test.js`
Definition of done:
- Child API/session routes authorize via HttpOnly cookie path (no client-side token persistence).
- Session end/revocation invalidates cookie-backed access immediately.
- End-to-end tests cover join, stream, turn send, and expired-session handling under cookie auth.
Validation:
- `node --test tests/session-auth-integration.test.js tests/use-child-console-hook.test.js tests/stream-route.test.js`

### 25) Nonce-based CSP rollout for strict script policy
Status: Open
Why:
- Current CSP uses `'unsafe-inline'` in `script-src` to preserve Next.js runtime hydration scripts.
- We should remove this exception and move to nonce-based CSP enforcement for stronger XSS resistance.
Scope:
- Introduce nonce generation/propagation per request (middleware/server integration).
- Apply nonce to framework/runtime inline scripts and any required app scripts.
- Remove `'unsafe-inline'` from `script-src` while keeping the app fully functional.
- Add regression tests/checks so CSP remains strict across upgrades.
Implementation notes (starter files):
- `next.config.mjs`
- `app/layout.js`
- `middleware.js` (new, if needed)
- `tests/security-headers.test.js`
Definition of done:
- `script-src` no longer requires `'unsafe-inline'`.
- Parent/child pages hydrate and function correctly with strict CSP enabled.
- CSP validation is covered in automated tests.
Validation:
- `npm run build`
- `node --test tests/security-headers.test.js`

### 29) Billing eligibility guard: no first-month intro coupon on resubscribe
Status: Open
Why:
- The current Stripe checkout flow automatically applies the first-month intro coupon (`$8 off`, advertised as `$1.99 first month`) when configured.
- Returning parents who are resubscribing should not receive the intro discount intended for first-time subscribers.
Scope:
- Detect resubscribe/returning-subscriber eligibility before creating subscription checkout sessions.
- Apply the first-month intro coupon only for first-time subscription starts; suppress it for resubscribe flows.
- Preserve support for manual promotion codes where applicable when the intro coupon is not auto-applied.
- Update parent-facing pricing/checkout copy if needed so resubscribing users are not shown first-month intro messaging.
Implementation notes (starter files):
- `src/server/billing-service.js`
- `src/server/billing-config.js` (only if eligibility needs a config flag/override)
- `app/api/billing/checkout-session/route.js`
- `tests/billing-service.test.js`
- `tests/billing-routes.test.js`
- `tests/playwright/parent-billing-consent-flow.spec.js`
Definition of done:
- Resubscribing users do not receive the automatic first-month intro coupon in Stripe Checkout session payloads.
- First-time subscribers still receive the configured intro coupon behavior.
- Automated tests cover both first-time and returning-subscriber checkout paths.
Validation:
- `node --test tests/billing-service.test.js tests/billing-routes.test.js`
- `npx playwright test tests/playwright/parent-billing-consent-flow.spec.js`

### 30) Billing lifecycle status correctness (cancel, active-through, resubscribe)
Status: Open
Why:
- Parent-facing billing state can be misleading after cancel/resubscribe events (for example showing `active` after cancellation without an expiry date, or showing `incomplete` after a renewed/recreated subscription).
- Incorrect lifecycle status messaging increases support burden and creates avoidable trust issues around access/renewal.
Scope:
- Audit and fix subscription status normalization for Stripe lifecycle transitions:
- canceled but still active-through-period (`cancel_at_period_end = true`)
- fully canceled/expired access
- resubscribe/recreated subscription after cancellation
- Ensure the app surfaces `active until` / `current_period_end_at` when cancellation is scheduled so parents know access end timing without leaving the app.
- Add an in-app notice/banner for "canceled, still active until <date>" state.
- Fix post-renewal/recreated subscription state so the app does not remain stuck on `Incomplete` when Stripe reports an active/trialing subscription.
- Verify webhook + reconcile flows correctly update local billing rows for the above transitions.
Implementation notes (starter files):
- `src/server/billing-service.js`
- `app/api/billing/subscription/route.js`
- `app/parent/hooks/useParentConsole.js`
- `app/parent/components/CoppaConsentPanel.js`
- `tests/billing-service.test.js`
- `tests/billing-reconcile-cron-routes.test.js`
- `tests/playwright/parent-billing-consent-flow.spec.js`
Definition of done:
- Cancel-at-period-end subscriptions show accurate status plus visible active-through date in-app.
- Fully expired subscriptions no longer appear active.
- Resubscribed/recreated subscriptions resolve to the correct non-`incomplete` state after sync/webhook processing.
- Automated tests cover cancel, scheduled-cancel active-through, expiry, and resubscribe transitions.
Validation:
- `node --test tests/billing-service.test.js tests/billing-reconcile-cron-routes.test.js`
- `npx playwright test tests/playwright/parent-billing-consent-flow.spec.js`

### 31) Billing/account UX discoverability pass (homepage CTA + in-app account tab)
Status: Open
Why:
- Key subscription actions and billing/account details are harder to find than they should be, especially for stressed/tired parents.
- Important information (for example subscription timing) is hidden behind "Manage billing" instead of being visible in our app.
Scope:
- Make the front-page trial/family plan section support a direct signup/start action (clear path into onboarding/checkout).
- Add a dedicated parent "Billing & account" tab/section that consolidates subscription status, billing actions, and key account information.
- Surface `active until` / renewal/cancel timing directly in the app (without requiring a click into the Stripe billing portal).
- Review and simplify billing-related labels/copy for fast scanning (especially canceled-but-still-active and resubscribe states).
- Maintain COPPA consent actions while improving separation between consent/legal actions and billing/account management.
Implementation notes (starter files):
- `app/page.js`
- `app/parent/page.js`
- `app/parent/section-config.js`
- `app/parent/components/CoppaConsentPanel.js`
- `app/parent/hooks/useParentConsole.js`
- `tests/playwright/parent-billing-consent-flow.spec.js`
- `tests/playwright/new-user-experience.spec.js`
Definition of done:
- Parents can start the trial/family plan flow from the homepage pricing/trial section.
- Parent dashboard includes a clearly labeled billing/account destination with visible subscription timing/status details.
- Core billing details are understandable without opening the external billing portal.
- Playwright coverage verifies the new entrypoint and in-app visibility of subscription timing/status.
Validation:
- `npx playwright test tests/playwright/new-user-experience.spec.js tests/playwright/parent-billing-consent-flow.spec.js`

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

### 26) SEO growth foundations (schema + semantics + indexing hardening)
Status: Open
Why:
- Baseline technical SEO is now in place (metadata/canonicals/robots/sitemap/noindex on app routes), but rankings will benefit from stronger semantic signals and richer search result eligibility.
Scope:
- Add JSON-LD schema to public marketing pages:
- `Organization` + `WebSite` (sitewide/root)
- `WebApplication`/`SoftwareApplication` (homepage)
- `FAQPage` on any page that gains an FAQ section
- Improve homepage semantic structure for crawlers/accessibility:
- Convert feature/step sublabels from presentation-only `<strong>` text to heading elements (`h3`) where appropriate
- Add a proper `<main>` landmark in shared page shell
- Add social preview image metadata scaffolding (`opengraph-image`, Twitter image), with a production asset path and fallback behavior
- Ensure preview/staging deployments are `noindex` to avoid duplicate-content indexing (for example via env-driven metadata/header rule)
Implementation notes (starter files):
- `app/layout.js`
- `app/page.js`
- `app/components/layout/AppShell.js`
- `app/opengraph-image.*` / `app/twitter-image.*` (new, if generated)
- `src/lib/seo.js`
Definition of done:
- Public pages emit valid JSON-LD and continue rendering existing metadata/canonical tags.
- Homepage heading hierarchy is semantically stronger without visual regressions.
- Preview deployments are protected from indexing while production remains indexable.
Validation:
- Verify rendered HTML contains schema + social image tags (`curl`/browser inspect)
- Run a rich-results/schema validator on homepage markup
- Manual spot-check of preview/prod robots behavior

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

### 27) SEO content expansion for high-intent parent search queries
Status: Open
Why:
- Ranking gains will come primarily from intent-targeted content (not additional meta tags) that matches how homeschool parents actually search.
Scope:
- Publish dedicated landing pages for high-intent queries (initial targets):
- AI tutor for homeschool families
- voice tutor for kids / voice-first learning support
- math help for homeschool students
- COPPA-safe / parent-guided AI tutoring
- Each page should target one core intent and include:
- clear problem/solution framing
- screenshots or workflow examples
- parent trust/safety guidance (privacy, parental controls)
- FAQ section and strong CTA
- Add internal linking from homepage/about/privacy where contextually relevant
Implementation notes (starter files):
- `app/` (new route pages, e.g. `app/ai-tutor-for-homeschool/page.js`)
- `app/page.js` (internal links)
- `docs/IMPLEMENTATION_SPEC.md` (content/page template guidance if desired)
Definition of done:
- At least 3 high-quality intent pages are shipped with unique metadata and clear internal links.
- Pages are substantive (not thin keyword pages) and aligned to real user intent.
Validation:
- Manual QA on mobile/desktop
- Verify metadata/canonical/OG tags on each new page
- Submit URLs in Search Console after deploy

### 28) SEO growth ops: authority, performance, and search-console feedback loop
Status: Open
Why:
- Sustainable ranking improvements require ongoing iteration across backlinks, CWV performance, and search query feedback.
Scope:
- Search ops:
- Set up and monitor Google Search Console + Bing Webmaster Tools
- Submit sitemap, monitor index coverage, and review query CTR/impressions
- Create a simple monthly SEO review checklist/report
- Performance:
- Measure and improve Core Web Vitals on public pages (focus on LCP/INP/CLS)
- Optimize future marketing images/social preview assets for size and stability
- Authority:
- Build outreach/backlink program targeting homeschool blogs, parent communities, edtech roundups, and founder-story placements
- Add trust signals/testimonials/case studies on public pages as available
Implementation notes (starter files):
- `docs/ANALYTICS_BASELINE.md` (or new SEO ops doc)
- `docs/README.md` / `docs/START_HERE.md` (ops checklist links)
- public marketing pages for trust/testimonial sections
Definition of done:
- Search Console/Bing ownership is verified and sitemap submitted.
- A repeatable SEO review checklist/report exists with owners and cadence.
- At least one CWV-focused optimization pass is completed and measured.
Validation:
- Capture baseline + post-change CWV metrics (Lighthouse/PageSpeed/Web Vitals)
- Record monthly query/click/indexing review notes in handoff/docs

---

## Parking Lot (Not Scheduled)

- Multi-language tutoring support.
- COPPA parent-rights self-serve UX (data summary/export/deletion hardening) (implementation notes: `docs/COPPA_LAUNCH_PLAN.md`).
- Native mobile wrapper once web UX stabilizes.
