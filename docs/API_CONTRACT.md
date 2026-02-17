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

## POST `/api/session/start`
Starts a session for a parent-owned child and issues one-time 10-minute join code.

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
    "status": "active",
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
  "policy_applied": ["none"],
  "model_used": "claude-sonnet-4-5-20250929"
}
```

## POST `/api/session/:id/parent-nudge`
Parent sends hidden nudge to steer tutor response.

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
