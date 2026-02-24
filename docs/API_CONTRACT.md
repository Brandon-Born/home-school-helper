# API Contract (v1)

## Conventions
- Content type: `application/json`.
- Error shape:
```json
{
  "error": "machine_readable_code",
  "message": "human readable message"
}
```
- Rate-limit behavior:
  - High-risk write routes may return `429` with:
  ```json
  {
    "error": "rate_limited",
    "message": "Too many requests. Please try again shortly."
  }
  ```
  - Enforcement uses a shared backend store in production so limits remain consistent across instances.

## Authentication Headers
- Parent routes require Supabase access token:
  - `Authorization: Bearer <parent_access_token>`
- Child tutoring routes require redeemed child session token:
  - `Authorization: Bearer <child_session_token>`

## GET `/api/parent/me`
Returns parent profile (and creates/syncs parent row from authenticated Supabase user if missing).

### Response (200)
```json
{
  "parent": {
    "id": "uuid",
    "auth_user_id": "uuid",
    "email": "parent@example.com",
    "full_name": "Parent Name",
    "onboarding_completed": false,
    "coppa_consent_required": true,
    "coppa_consent_status": "pending",
    "coppa_consent_updated_at": null,
    "coppa_policy_version": "2026-02-19",
    "coppa_consent_method": null,
    "created_at": "timestamp"
  },
  "user": {
    "id": "uuid",
    "email": "parent@example.com"
  }
}
```

## GET `/api/privacy/consent`
Returns consent checkpoint state for the authenticated parent.

### Response (200)
```json
{
  "consent": {
    "required": true,
    "status": "pending",
    "updated_at": null,
    "policy_version": "2026-02-19",
    "policy_url": "/privacy",
    "method": null
  }
}
```

Notes:
- If database consent columns are not migrated yet, response may return `required=false` with `status=granted` as a temporary local/dev fallback.

## GET `/api/privacy/child-data-summary`
Returns parent-readable summary of child-data categories and aggregate counts.

Rate limit:
- Scoped per client address + parent id. Bursts above configured threshold return `429 rate_limited`.

### Response (200)
```json
{
  "summary": {
    "generated_at": "timestamp",
    "parent_id": "uuid",
    "retention": {
      "transcript_days": 30,
      "raw_audio_stored": false
    },
    "counts": {
      "children": 1,
      "sessions": 3,
      "active_sessions": 1,
      "ended_sessions": 2,
      "paused_sessions": 0,
      "transcript_messages": 42,
      "child_visible_messages": 36,
      "parent_only_messages": 6
    },
    "windows": {
      "first_child_created_at": "timestamp",
      "last_child_created_at": "timestamp",
      "first_session_started_at": "timestamp",
      "last_session_started_at": "timestamp",
      "first_message_created_at": "timestamp",
      "last_message_created_at": "timestamp"
    },
    "children": [
      {
        "id": "uuid",
        "first_name": "Ava",
        "created_at": "timestamp",
        "has_profile_notes": true,
        "has_special_needs": false
      }
    ],
    "categories": [
      "parent account",
      "child profiles",
      "session metadata",
      "transcript metadata"
    ]
  }
}
```

## GET `/api/privacy/requests`
Returns recent parent privacy requests (export/delete) and statuses.

Rate limit:
- Scoped per client address + parent id. Bursts above configured threshold return `429 rate_limited`.

### Response (200)
```json
{
  "requests": [
    {
      "id": "uuid",
      "request_type": "export",
      "status": "completed",
      "reason": "Need records",
      "requested_at": "timestamp",
      "completed_at": "timestamp",
      "error_message": null,
      "result_json": {
        "counts": {
          "children": 1,
          "sessions": 3,
          "transcript_messages": 42
        },
        "generated_at": "timestamp"
      }
    }
  ]
}
```

## GET `/api/billing/subscription`
Returns normalized billing state for the authenticated parent.

### Response (200)
```json
{
  "billing": {
    "enabled": true,
    "provider": "stripe",
    "subscription": {
      "provider": "stripe",
      "status": "trialing",
      "has_access": true,
      "provider_customer_id": "cus_123",
      "provider_subscription_id": "sub_123",
      "provider_price_id": "price_123",
      "trial_start_at": "timestamp",
      "trial_end_at": "timestamp",
      "current_period_start_at": "timestamp",
      "current_period_end_at": "timestamp",
      "cancel_at_period_end": false,
      "canceled_at": null,
      "updated_at": "timestamp"
    }
  }
}
```

When billing is disabled, the route returns:
- `billing.enabled=false`
- `billing.provider=null`
- `billing.subscription=null`

## POST `/api/privacy/consent`
Sets parent consent status.

### Request
```json
{
  "action": "grant"
}
```

Allowed `action` values:
- `grant`
- `revoke`

### Response (200)
```json
{
  "consent": {
    "required": true,
    "status": "granted",
    "updated_at": "timestamp",
    "policy_version": "2026-02-19",
    "policy_url": "/privacy",
    "method": "parent_self_attestation"
  }
}
```

### Errors
- `400 validation_error`: Action must be `grant` or `revoke`.
- `409 billing_required_for_coppa_grant`: Parent payment verification is required before `grant`.
- `500 coppa_consent_update_failed`: Consent state could not be persisted.
- `500 coppa_consent_audit_failed`: Consent audit event could not be persisted.

## POST `/api/billing/verification-session`
Legacy/deprecated flow endpoint. Creates a Stripe Checkout Session URL for a separate parent payment verification step (older 2-step COPPA flow) before subscription signup.

### Response (200)
```json
{
  "verification": {
    "id": "cs_123",
    "url": "https://checkout.stripe.com/c/pay/...",
    "verification_amount_cents": 100,
    "verification_currency": "usd"
  }
}
```

## POST `/api/billing/checkout-session`
Creates a Stripe Checkout Session URL for the authenticated parent family subscription signup (single-step hosted checkout).

Notes:
- Intended pricing model: `$1.99 first month`, then `$9.99/month` (typically implemented with the standard monthly price plus a one-time intro coupon/discount).
- Stripe Checkout allows promotion codes for tester/friends/family discounts.
- COPPA consent is granted after a successful paid signup webhook is processed.

### Response (200)
```json
{
  "checkout": {
    "id": "cs_123",
    "url": "https://checkout.stripe.com/c/pay/...",
    "intro_offer": {
      "first_month_discount_coupon_applied": true
    }
  }
}
```

## POST `/api/billing/portal-session`
Creates a Stripe Billing Portal session URL for the authenticated parent.

### Response (200)
```json
{
  "portal": {
    "url": "https://billing.stripe.com/p/session/..."
  }
}
```

## POST `/api/billing/webhook`
Consumes Stripe webhook events for paid signup consent confirmation and subscription lifecycle updates.

### Headers
- `stripe-signature: <signed-header>`

### Response (200)
```json
{
  "ok": true,
  "result": {
    "duplicate": false,
    "processed": true,
    "event_type": "checkout.session.completed",
    "outcome": {
      "skipped": false,
      "reason": null
    }
  }
}
```

## GET `/api/internal/billing/reconcile/hourly`
Internal Vercel cron endpoint. Runs an hourly reconciliation sweep for billing rows in problem states (`incomplete`, `past_due`, `unpaid`, etc.) against Stripe.

Auth:
- `Authorization: Bearer <CRON_SECRET>` (Vercel cron)

Optional query params:
- `dry_run=1` (do not write DB updates)
- `limit=<positive-int>` (override batch limit)

## GET `/api/internal/billing/reconcile/nightly`
Internal Vercel cron endpoint. Runs a nightly full reconciliation sweep across local Stripe billing rows.

Auth:
- `Authorization: Bearer <CRON_SECRET>` (Vercel cron)

Optional query params:
- `dry_run=1`
- `limit=<positive-int>`

## POST `/api/privacy/export`
Creates and processes a parent export request, then returns a snapshot payload for immediate review/download workflows.

Rate limit:
- Scoped per client address + parent id. Bursts above configured threshold return `429 rate_limited`.

### Request
```json
{
  "reason": "Need records for review"
}
```

### Response (200)
```json
{
  "request": {
    "id": "uuid",
    "request_type": "export",
    "status": "completed",
    "reason": "Need records for review",
    "requested_at": "timestamp",
    "completed_at": "timestamp",
    "error_message": null,
    "result_json": {
      "counts": {
        "children": 1,
        "sessions": 3,
        "transcript_messages": 42
      },
      "generated_at": "timestamp"
    }
  },
  "export_snapshot": {
    "generated_at": "timestamp",
    "parent_id": "uuid",
    "summary": {
      "counts": {
        "children": 1,
        "sessions": 3,
        "transcript_messages": 42
      }
    },
    "data": {
      "children": [],
      "sessions": [],
      "messages": []
    }
  }
}
```

### Errors
- `500 privacy_request_create_failed`: Request row could not be created.
- `500 privacy_export_*`: Snapshot generation failed.

## POST `/api/privacy/delete`
Creates and processes a parent deletion request that removes all child profiles and cascade-linked session/transcript data.

Rate limit:
- Scoped per client address + parent id. Bursts above configured threshold return `429 rate_limited`.

### Request
```json
{
  "reason": "Delete all child records",
  "confirm_phrase": "DELETE CHILD DATA"
}
```

### Response (200)
```json
{
  "request": {
    "id": "uuid",
    "request_type": "delete",
    "status": "completed",
    "reason": "Delete all child records",
    "requested_at": "timestamp",
    "completed_at": "timestamp",
    "error_message": null,
    "result_json": {
      "deleted_children": 1,
      "deleted_sessions": 3,
      "deleted_messages": 42,
      "requested_at": "timestamp"
    }
  },
  "deletion": {
    "deleted_children": 1,
    "deleted_sessions": 3,
    "deleted_messages": 42,
    "requested_at": "timestamp"
  }
}
```

### Errors
- `400 validation_error`: `confirm_phrase` must match the expected confirmation phrase.
- `500 privacy_delete_failed`: Child data could not be deleted.

## GET `/api/children`
Lists children for authenticated parent.

### Response (200)
```json
{
  "children": [
    {
      "id": "uuid",
      "first_name": "Ava",
      "age": 10,
      "grade": "5",
      "subjects": ["Math", "Science"],
      "profile_notes": "Curious and energetic",
      "special_needs": "Needs short instructions",
      "created_at": "timestamp"
    }
  ]
}
```

## POST `/api/children`
Creates a child profile for authenticated parent.

### Request
```json
{
  "child_name": "Ava",
  "age": 10,
  "grade": "5",
  "subjects": ["Math", "Science"],
  "personality_description": "Curious and energetic",
  "special_needs": "Needs short instructions"
}
```

### Response (201)
```json
{
  "child": {
    "id": "uuid",
    "first_name": "Ava",
    "age": 10,
    "grade": "5",
    "subjects": ["Math", "Science"],
    "profile_notes": "Curious and energetic",
    "special_needs": "Needs short instructions",
    "created_at": "timestamp"
  }
}
```

### Errors
- `403 coppa_consent_required`: Parent consent must be granted first.
- `402 billing_subscription_required`: An active/trialing family subscription is required before starting new sessions when billing is enabled.

## PUT `/api/children/:id`
Updates a child profile for authenticated parent. Parent must own the child.

### Request
```json
{
  "child_name": "Ava",
  "age": 11,
  "grade": "6",
  "subjects": ["Math", "Science"],
  "personality_description": "Curious and energetic",
  "special_needs": "Needs short instructions"
}
```

### Response (200)
```json
{
  "child": {
    "id": "uuid",
    "first_name": "Ava",
    "age": 11,
    "grade": "6",
    "subjects": ["Math", "Science"],
    "profile_notes": "Curious and energetic",
    "special_needs": "Needs short instructions",
    "created_at": "timestamp"
  }
}
```

### Errors
- `404 child_not_found`: Child does not exist or is not owned by this parent.

## DELETE `/api/children/:id`
Deletes a child profile for authenticated parent. Blocked if the child has an active session.

### Response (200)
```json
{
  "deleted": true
}
```

### Errors
- `404 child_not_found`: Child does not exist or is not owned by this parent.
- `409 active_session_exists`: Child has an active session. End it first.

## GET `/api/session/active`
Lists all active sessions for the authenticated parent, enriched with child names.

Rate limit:
- Scoped per client address + parent id. Bursts above configured threshold return `429 rate_limited`.

### Response (200)
```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "child_id": "uuid",
      "child_name": "Ava",
      "status": "active",
      "daily_context": {
        "daily_subjects": ["Math"],
        "parent_context": "Focus on confidence.",
        "goal_notes": null,
        "additional_context": null
      },
      "started_at": "timestamp",
      "join_code": "AB12CD34",
      "expires_at": "timestamp"
    }
  ]
}
```

## POST `/api/session/:id/manage`
Manages an active session. Supports two actions: ending a session or regenerating a join code.

Rate limit:
- Scoped per client address + parent id + session id. Bursts above configured threshold return `429 rate_limited`.

### Request — End Session
```json
{
  "action": "end"
}
```

### Response (200) — End Session
```json
{
  "session": { "id": "uuid", "status": "ended" }
}
```

### Request — Regenerate Join Code
```json
{
  "action": "regenerate_code"
}
```

### Response (200) — Regenerate Join Code
```json
{
  "session_id": "uuid",
  "join_code": "AB12CD34",
  "expires_at": "timestamp"
}
```

### Errors
- `400 invalid_action`: Action must be 'end' or 'regenerate_code'.
- `404 session_not_found`: Session not found for this parent.
- `409 session_not_active`: Session is not active (regenerate_code only).

## POST `/api/session/start`
Starts a session for a parent-owned child and issues one-time 10-minute join code.

Rate limit:
- Scoped per client address. Bursts above configured threshold return `429 rate_limited`.

### Request
```json
{
  "child_id": "uuid",
  "daily_subjects": ["Math", "Reading"],
  "parent_context": "Focus on confidence today.",
  "goal_notes": "Finish one-step equations",
  "additional_context": "Child was tired this morning"
}
```

### Response (201)
```json
{
  "session": {
    "session_id": "uuid",
    "child_id": "uuid",
    "child_name": "Ava",
    "status": "active",
    "started_at": "timestamp",
    "join_code": "AB12CD34",
    "expires_at": "timestamp",
    "daily_context": {
      "daily_subjects": ["Math", "Reading"],
      "parent_context": "Focus on confidence today.",
      "goal_notes": "Finish one-step equations",
      "additional_context": "Child was tired this morning"
    }
  }
}
```

### Errors
- `403 coppa_consent_required`: Parent consent must be granted first.

## POST `/api/session/join`
Redeems one-time join code and returns child session token.

Rate limit:
- Scoped per client address. Bursts above configured threshold return `429 rate_limited`.

### Request
```json
{
  "code": "AB12CD34",
  "device_fingerprint": "optional-device-id"
}
```

### Response (200)
```json
{
  "session_access": {
    "session_id": "uuid",
    "child_id": "uuid",
    "child_session_token": "opaque-token",
    "expires_at": "timestamp"
  }
}
```

## POST `/api/session/:id/child-turn`
Child submits a tutoring turn.

Rate limit:
- Scoped per client address + session id. Bursts above configured threshold return `429 rate_limited`.

### Request
```json
{
  "student_input": "Can you help me solve 3x + 4 = 19?",
  "client_metadata": {
    "input_mode": "voice"
  }
}
```

### Response (200)
```json
{
  "assistant_text": "Let’s solve it together. What should we do first to isolate x?",
  "speak_payload": {
    "text": "Let’s solve it together. What should we do first to isolate x?",
    "voice": "default",
    "mode": "hybrid_tts"
  },
  "input_message": {
    "id": "uuid",
    "actor_type": "child",
    "visibility_scope": "child_and_parent",
    "content": "Can you help me solve 3x + 4 = 19?",
    "created_at": "timestamp"
  },
  "assistant_message": {
    "id": "uuid",
    "actor_type": "assistant",
    "visibility_scope": "child_and_parent",
    "content": "Let’s solve it together. What should we do first to isolate x?",
    "policy_flags": ["none"],
    "created_at": "timestamp"
  },
  "policy_applied": ["none"],
  "model_used": "claude-sonnet-4-5-20250929"
}
```

Notes:
- `speak_payload.text` is server-normalized for read-aloud delivery (markdown/emoji/style markers removed when needed) while `assistant_text` remains transcript-accurate.

Notes:
- `input_message` and `assistant_message` are persisted transcript rows returned inline so the client can render and speak immediately without waiting for stream polling.

## POST `/api/session/:id/parent-nudge`
Parent sends hidden nudge to steer tutoring in the background.

Rate limit:
- Scoped per client address + session id. Bursts above configured threshold return `429 rate_limited`.

### Request
```json
{
  "nudge_text": "Student is getting frustrated; slow down and praise effort.",
  "parent_guidance": "Do not reveal this guidance."
}
```

### Response (200)
```json
{
  "assistant_text": "Understood. I’ll keep the pacing slower and confidence-first.",
  "speak_payload": {
    "text": "You’re doing well. Let’s take one small step together.",
    "voice": "default",
    "mode": "hybrid_tts"
  },
  "input_message": {
    "id": "uuid",
    "actor_type": "parent",
    "visibility_scope": "parent_only",
    "content": "Student is getting frustrated; slow down and praise effort.",
    "created_at": "timestamp"
  },
  "assistant_message": {
    "id": "uuid",
    "actor_type": "assistant",
    "visibility_scope": "parent_only",
    "content": "Understood. I’ll keep the pacing slower and confidence-first.",
    "policy_flags": ["none"],
    "created_at": "timestamp"
  },
  "policy_applied": ["none"],
  "model_used": "claude-sonnet-4-5-20250929",
  "queued": true
}
```

Notes:
- Parent-nudge assistant replies are private (`parent_only`) side-channel acknowledgements for the parent.
- Child-visible tutoring continues on normal child turns and remains influenced by the latest parent steering context.

## GET `/api/session/:id/messages`
Fetches transcript rows for a session.

Auth behavior:
- Parent bearer token: returns all visibility scopes.
- Child session token: returns only `child_and_parent` rows.

### Response (200)
```json
{
  "messages": [
    {
      "id": "uuid",
      "actor_type": "assistant",
      "visibility_scope": "child_and_parent",
      "content": "Let's solve this together.",
      "policy_flags": ["none"],
      "created_at": "timestamp"
    }
  ],
  "visibility": "all"
}
```

## GET `/api/session/:id/stream`
Realtime transcript subscription stream (SSE).

Auth behavior:
- Parent bearer token: receives all visibility scopes.
- Child session token: receives only `child_and_parent` rows.

Response headers:
- `x-stream-transport-mode`: selected runtime transport for this stream connection (`realtime` or `polling`).

### Stream events
- `snapshot`: initial transcript payload.
- `message_append`: newly appended transcript rows.
- `error`: recoverable stream-side polling error.

Telemetry:
- Server logs structured stream events under `[stream-server]` (connect, disconnect, poll error/recovery, connect failures).
- Client logs structured stream events under `[stream-client]` (connect attempts, reconnect scheduling, disconnect causes, parent auth refresh attempts/results).
- Server disconnect telemetry includes realtime lifecycle counters (`realtime_subscribe_attempts`, `realtime_subscribe_success`, `realtime_unsubscribe_count`) for leak/churn monitoring.
- Optional env toggles:
  - `STREAM_TELEMETRY_DISABLED=1` disables server stream telemetry logs.
  - `NEXT_PUBLIC_STREAM_TELEMETRY_DISABLED=1` disables client stream telemetry logs.

Transport behavior:
- Default `STREAM_TRANSPORT_MODE=auto` uses direct Supabase Realtime message subscriptions and falls back to polling if realtime is unavailable.
- `STREAM_TRANSPORT_MODE=realtime` requires realtime subscription success (no polling fallback).
- `STREAM_TRANSPORT_MODE=polling` forces the legacy polling path.

Operational checks (realtime channel health):
- Validate disconnect summaries keep `realtime_subscribe_success` and `realtime_unsubscribe_count` near 1:1 per stream lifecycle.
- Watch for repeated `stream_realtime_subscribe` attempts without matching `stream_realtime_unsubscribe` events for the same session/visibility pair.
- Investigate sustained `stream_transport_connected` fallback to `polling` in `auto` mode as a realtime infrastructure degradation signal.
- For incident isolation, temporarily set `STREAM_TRANSPORT_MODE=polling` to keep transcript streaming available while realtime issues are triaged.

## POST `/api/session/:id/speech/transcribe`
Transcribes child audio using Google Speech-to-Text V2.

Rate limit:
- Scoped per client address + session id. Bursts above configured threshold return `429 rate_limited`.

Auth behavior:
- Requires valid child session bearer token for this session.

Telemetry:
- Server voice events log under `[voice-server]` with dashboard-friendly metric rows:
  - Shape: `{ "event": "voice_metric", "metric": "<name>", "count": 1, ...dimensions, "at": "<iso>" }`
  - Core metrics: `speech_request_success`, `speech_request_retry`, `speech_provider_timeout`, `speech_route_success`, `speech_route_rate_limited`, `speech_route_auth_failed`, `speech_route_failed`.
- Client voice events log under `[voice-client]` with the same metric row shape.
  - Core metrics: `cloud_stt_transcribe_success`, `cloud_stt_transcribe_failed`, `cloud_tts_fallback`, `browser_tts_fallback_used`, `microphone_permission_denied`, `tts_autoplay_blocked`, `tts_unavailable`.
- Optional env toggles:
  - `SPEECH_TELEMETRY_DISABLED=1` disables server voice telemetry logs.
  - `NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED=1` disables client voice telemetry logs.

### Request
- `multipart/form-data`
- field `audio`: recorded audio file/blob.
- optional field `language_code`: BCP-47 language code (default server config).

### Response (200)
```json
{
  "transcript": "Can we do another multiplication example?"
}
```

## POST `/api/session/:id/speech/synthesize`
Synthesizes child-facing tutor speech audio using Google Chirp 3 TTS.

Rate limit:
- Scoped per client address + session id. Bursts above configured threshold return `429 rate_limited`.

Auth behavior:
- Requires valid child session bearer token for this session.

### Request
```json
{
  "text": "Great effort. Let us solve this step by step.",
  "speaking_rate": 1.0
}
```

### Response (200)
- Binary audio payload (`audio/mpeg`).

## POST `/api/session/:id/override`
Parent toggles direct-answer mode for a bounded duration.

### Request
```json
{
  "enabled": true,
  "duration_minutes": 15
}
```

### Response (200)
```json
{
  "override": {
    "session_id": "uuid",
    "direct_answer_enabled": true,
    "expires_at": "timestamp"
  }
}
```

## POST `/api/analytics/event`
Ingests privacy-safe product funnel events.

Rate limit:
- Scoped per client address. Bursts above configured threshold return `429 rate_limited`.

Auth behavior:
- Public endpoint (supports both pre-join and authenticated flows).
- Payload is strictly allowlisted and does not accept transcript/audio content.

### Request
```json
{
  "event": "child_join",
  "payload": {
    "status": "success"
  }
}
```

Allowed events:
- `session_start`
- `child_join`
- `turn_send`
- `nudge_send`
- `voice_usage`

### Response (202)
```json
{
  "accepted": true
}
```

## POST `/api/test-auth/bootstrap` (test-only)
Creates a one-time auth link for Playwright automation without interactive OAuth.

Availability:
- Disabled by default.
- Returns `404 not_found` unless `ENABLE_TEST_AUTH_BOOTSTRAP=1`.
- Always disabled in production (`NODE_ENV=production`).

Authorization:
- Requires header `x-test-auth-secret: <PLAYWRIGHT_TEST_AUTH_SECRET>`.

Environment requirements when enabled:
- `PLAYWRIGHT_TEST_AUTH_SECRET`
- `PLAYWRIGHT_TEST_AUTH_EMAIL`

### Response (200)
```json
{
  "auth": {
    "email": "playwright-parent@example.test",
    "action_link": "https://<project>.supabase.co/auth/v1/verify?...",
    "redirect_to": "http://localhost:3000/auth/callback"
  }
}
```

## Visibility Rules
- Parent can read parent-only and shared messages for owned sessions.
- Child routes only accept valid child session token issued by `/api/session/join`.
- Parent guidance must never be echoed verbatim in child-visible content.
- Tutor context (`profile`, `daily_context`, and direct-answer override) is resolved from trusted server-side session data, not client payload fields.

## Stability Notes
- Any response-shape change requires updates to tests, docs, and handoff log.
