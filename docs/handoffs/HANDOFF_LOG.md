# Handoff Log

Notes:
- Compacted on 2026-02-19.
- Kept the 3 most recent detailed handoffs.
- Deduplicated older history into a durable summary for fast agent onboarding.

## 2026-02-25T02:53:28Z - Codex

### Scope Worked
- Implemented billing fixes and UX improvements for resubscribe flows, lifecycle status visibility, and faster billing/account access.
- Added direct family-plan signup CTA from the homepage pricing section.

### Last Agent Accomplished
- Prevented automatic first-month intro coupon application for resubscribing parents while preserving promo code entry when the intro coupon is not auto-applied (`src/server/billing-service.js`).
- Improved billing access normalization so canceled subscriptions with remaining paid period access (`current_period_end_at` in the future) still count as active access.
- Added immediate Stripe subscription sync on `checkout.session.completed` (when Stripe client is available) to reduce lingering `incomplete` status after checkout.
- Added a dedicated `Billing & Account` parent dashboard tab and moved subscription/consent UI there, leaving privacy/data controls in the `Privacy & Data` tab.
- Surfaced in-app subscription timing details (`Current period ends` / `Active until`) plus a cancel-scheduled notice in `CoppaConsentPanel`.
- Updated resubscribe onboarding copy/title to avoid showing first-month intro messaging in restart flows.
- Added a homepage pricing CTA button (`Start family plan`) linking directly to `/parent`.
- Expanded unit and Playwright coverage for coupon eligibility, canceled-active-through access, billing tab UI, and cancel notice visibility.

### Files Touched
- `src/server/billing-service.js`
- `app/parent/components/CoppaConsentPanel.js`
- `app/parent/page.js`
- `app/parent/section-config.js`
- `app/page.js`
- `tests/billing-service.test.js`
- `tests/parent-section-config.test.js`
- `tests/playwright/helpers/parent-console.js`
- `tests/playwright/parent-auth-bootstrap.spec.js`
- `tests/playwright/parent-billing-consent-flow.spec.js`
- `docs/PRODUCT_BACKLOG.md`
- `docs/handoffs/HANDOFF_LOG.md`

### Tests / Checks Run
- `node --test tests/billing-service.test.js tests/parent-section-config.test.js tests/billing-routes.test.js` (pass)
- `npx playwright test tests/playwright/parent-billing-consent-flow.spec.js tests/playwright/parent-auth-bootstrap.spec.js` (pass)

### Open Risks / Issues
- `processStripeWebhookEvent` only performs immediate checkout subscription sync when a Stripe client is available in the current runtime/config path; otherwise webhook/reconcile still resolves status asynchronously.

### Next Steps (Ordered)
1. Monitor real Stripe resubscribe webhook timing in production/staging to confirm the immediate-sync path reduces `incomplete` UI flashes.
2. Consider adding a dedicated backend billing-status display field (for example `cancel_scheduled`) if more UI surfaces need consistent wording.

### Blocking Questions
- None.

## 2026-02-24T12:59:00Z - Antigravity

### Scope Worked
- Removed redundant pricing text from the sign-up flow.
- Streamlined the active subscription management UI in the parent COPPA consent panel to separate subscription details from legal consent actions.

### Last Agent Accomplished
- Cleaned up duplicate `$1.99` onboarding headers between `app/parent/page.js` and `CoppaConsentPanel.js`.
- Simplified management text in `CoppaConsentPanel.js` to elegantly reflect subscription status and plan pricing without aggressive upsell repetition once a subscription is active.
- Refined the "Managed" tab layout for subscribed users: changed the title to "Subscription & consent", grouped the billing pill under a visually clear "Subscription details" card, and made "Manage billing" a primary button while demoting "Revoke consent" to an explicit red ghost button.
- Implemented an "Are you sure?" confirmation modal overlay for the "Revoke consent" button to prevent accidental clicks while maintaining strict COPPA compliance.
- Updated Playwright E2E assertions in `parent-billing-consent-flow.spec.js` to explicitly test for the new "Subscription & consent" title and improved component structure.

### Files Touched
- `app/parent/page.js`
- `app/parent/components/CoppaConsentPanel.js`
- `tests/playwright/parent-billing-consent-flow.spec.js`
- `docs/handoffs/HANDOFF_LOG.md`

### Tests / Checks Run
- Manually verified Next.js dev server rendering the `parent` route successfully without errors.
- Ran `npx playwright test tests/playwright/parent-billing-consent-flow.spec.js` which passed cleanly against the local dev server.

### Open Risks / Issues
- Local dev server Playwright execution continues to experience sporadic 30s timeouts on initial Next.js compilations for unrelated child routes when run concurrently via the raw test script.

### Next Steps (Ordered)
1. Verify pending backlog items or await User requests.

### Blocking Questions
- None.

## 2026-02-21T14:35:00Z - Antigravity

### Scope Worked
- Resolved a layout bug in the child interface where the microphone button text caused the composer to squish or misalign on mobile viewports.

### Last Agent Accomplished
- Wrapped the verbose microphone toggle text in a `span` with a new `btn-record__text` class.
- Added a `@media` query to `components.css` to hide the verbose text and render a clean, circular icon button on screens smaller than 600px.
- Verified correct layout alignment and vertical message scrolling capability across emulated mobile devices.

### Files Touched
- `app/child/components/TutorComposerPanel.js`
- `app/styles/components.css`
- `docs/handoffs/HANDOFF_LOG.md`

### Tests / Checks Run
- Simulated mobile view in browser subagent.
- Forced chat overflow with mock data to vet active scrolling. Layout remained perfectly stable.
- `npm run test:e2e` Playwright test suite passed for all parent, child, and component tests except for a known flake (`transport-mode-stream.spec.js`) entirely unrelated to UI styles.

### Open Risks / Issues
- None.

### Next Steps (Ordered)
1. Verify pending backlog items or await User requests.

### Blocking Questions
- None.

## 2026-02-20T03:41:36Z - Codex

### Scope Worked
- Improved child voice UX for kids with tap-to-talk copy simplification, auto-submit after cloud transcription, and mic button placement next to Ask.
- Hid expired join code display on parent active session cards.

### Last Agent Accomplished
- Added transcript callback plumbing from `useChildConsole` -> `useChildVoiceRuntime` -> `useChildVoiceCapture` -> cloud strategy.
- Implemented shared send helper in `useChildConsole` and auto-submit flow when cloud transcript is ready.
- Updated child voice copy to simpler phrases and moved mic button next to Ask with trailing microphone emoji.
- Updated active session card rendering to suppress join code and expiry text when code is expired.
- Added/updated unit tests for cloud transcript callback submit behavior and revised voice status strings.

### Files Touched
- `app/child/hooks/useChildConsole.js`
- `app/child/hooks/useChildVoiceRuntime.js`
- `app/child/hooks/voice/useChildVoiceCapture.js`
- `app/child/hooks/voice/useCloudVoiceCaptureStrategy.js`
- `app/child/hooks/voice/useBrowserVoiceCaptureStrategy.js`
- `app/child/hooks/voice/speech-status.js`
- `app/child/components/TutorComposerPanel.js`
- `app/parent/components/ActiveSessionsPanel.js`
- `tests/use-cloud-voice-capture-strategy.test.js`
- `tests/use-child-voice-capture.test.js`
- `tests/use-browser-voice-capture-strategy.test.js`
- `docs/handoffs/HANDOFF_LOG.md`

### Tests / Checks Run
- Command: `npm run test:unit -- tests/use-child-console-hook.test.js tests/use-child-voice-capture.test.js tests/use-cloud-voice-capture-strategy.test.js tests/use-browser-voice-capture-strategy.test.js tests/use-parent-sessions-hook.test.js tests/use-parent-console-hook.test.js`
- Result: pass (18 tests, 0 failures).

### Open Risks / Issues
- Mic button placement change is validated by unit tests but not yet covered by a browser e2e assertion.

### Next Steps (Ordered)
1. Add a Playwright child page assertion for mic button placement/label and one-tap start + second-tap stop flow.
2. Add a component-level assertion that expired session cards hide join code text.

### Blocking Questions
- None.

## 2026-02-20T22:21:03Z - Codex

### Scope Worked
- Added Playwright e2e coverage for private parent-side nudge acknowledgements and child transcript isolation.

### Last Agent Accomplished
- Added a new Playwright spec that validates:
  - parent sends nudge via parent UI,
  - nudge response persists assistant acknowledgement as `parent_only`,
  - parent-visible transcript API includes private nudge + private assistant acknowledgement,
  - child-visible transcript API excludes those private messages,
  - child can still submit a normal `child-turn` and receive a `child_and_parent` assistant reply.
- Used child token auth for child transcript assertions and parent bearer header captured from the nudge request for parent transcript assertions.

### Files Touched
- `tests/playwright/parent-private-nudge-visibility.spec.js`
- `docs/handoffs/HANDOFF_LOG.md`

### Tests / Checks Run
- Command: `npx playwright test tests/playwright/parent-private-nudge-visibility.spec.js --project=chromium`
- Result: pass (1 test, 0 failures).

### Open Risks / Issues
- Spec relies on test-auth bootstrap/session state and dev server stability; if CI auth bootstrap drifts, this test can fail before exercising the transcript assertions.

### Next Steps (Ordered)
1. Optionally add a companion assertion in this spec that verifies parent transcript UI renders the private acknowledgement row once stream sync completes.
2. Add this spec to any tagged smoke subset if parent-guidance privacy is considered a release blocker.

### Blocking Questions
- None.

## Historical Summary (Deduplicated, Through 2026-02-20T22:13:46Z)

### What Actually Landed (Keep In Mind)
- **Voice/Audio UX**: Switched child microphone interaction to tap-to-toggle. Fixed tap-to-toggle voice capture orchestration cleanup preventing immediate turnoff. Prevented child hold-to-talk UI reflow during press by freezing relevant UI state until release.
- **Child UI**: Redesigned child chat experience (`/child`) from stacked panels to a modern full-viewport chat layout (pinned bottom input, auto-scrolling flex transcript). Styled messages as right/left chat bubbles. Enforced uppercase join-code entry on the child page.
- **Parent UI**: Refined parent dashboard sidebar copy and added pure-CSS view-switch animations. Elevated parent steering to a persistent, high-priority private channel. Removed duplicate join-code/expiry display from the Sessions share panel card.
- **Tutor/Context Pipeline**: Implemented rolling session-memory compaction for tutor turn context to retain continuity in long sessions. Reduced robotic tutor responses by improving turn prompt context (including recent transcript lines) and name usage behavior.
- **Privacy/COPPA**: Completed COPPA Phase C parent self-serve privacy flows (requests list, export, delete) with migration, APIs, UI wiring, tests, and docs updates.
- **Infrastructure/Testing**: Hardened session end behavior to avoid ending sessions before child token revocation succeeds. Added true first-time parent onboarding e2e coverage.

### Dedup Decisions Applied
- Compacted on 2026-02-21.
- Retained the three most recent detailed handoffs (Child Mobile Layout, Voice UX improvements, Private Parent Nudge Visibility).
- Collapsed all work from `2026-02-20T22:13:46Z` and older into this durable summary.
