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
    "created_at": "timestamp"
  },
  "user": {
    "id": "uuid",
    "email": "parent@example.com"
  }
}
```

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
      "started_at": "timestamp"
    }
  ]
}
```

## POST `/api/session/:id/manage`
Manages an active session. Supports two actions: ending a session or regenerating a join code.

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
- `input_message` and `assistant_message` are persisted transcript rows returned inline so the client can render and speak immediately without waiting for stream polling.

## POST `/api/session/:id/parent-nudge`
Parent sends hidden nudge to steer tutor response.

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
  "assistant_text": "You’re doing well. Let’s take one small step together.",
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
    "visibility_scope": "child_and_parent",
    "content": "You’re doing well. Let’s take one small step together.",
    "policy_flags": ["none"],
    "created_at": "timestamp"
  },
  "policy_applied": ["none"],
  "model_used": "claude-sonnet-4-5-20250929",
  "queued": true
}
```

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

### Stream events
- `snapshot`: initial transcript payload.
- `message_append`: newly appended transcript rows.
- `error`: recoverable stream-side polling error.

## POST `/api/session/:id/speech/transcribe`
Transcribes child audio using Google Speech-to-Text V2.

Rate limit:
- Scoped per client address + session id. Bursts above configured threshold return `429 rate_limited`.

Auth behavior:
- Requires valid child session bearer token for this session.

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

## Visibility Rules
- Parent can read parent-only and shared messages for owned sessions.
- Child routes only accept valid child session token issued by `/api/session/join`.
- Parent guidance must never be echoed verbatim in child-visible content.
- Tutor context (`profile`, `daily_context`, and direct-answer override) is resolved from trusted server-side session data, not client payload fields.

## Stability Notes
- Any response-shape change requires updates to tests, docs, and handoff log.
