# API Contract (v1)

## Conventions
- Content type: `application/json`.
- Auth: parent routes require authenticated parent session; child routes require valid session join token.
- Error shape:
```json
{
  "error": "machine_readable_code",
  "message": "human readable message"
}
```

## POST `/api/session/:id/child-turn`
Child submits a tutoring turn.

### Request
```json
{
  "student_input": "Can you help me solve 3x + 4 = 19?",
  "parent_guidance": "Keep it scaffolded and ask one question at a time.",
  "profile": {
    "age": 10,
    "grade": "5",
    "subjects": ["math"]
  },
  "daily_context": {
    "focus": "one-step equations"
  },
  "allow_direct_answer": false
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
  "model_used": "claude-3-5-sonnet-latest"
}
```

### Errors
- `400 child_turn_failed`

## POST `/api/session/:id/parent-nudge`
Parent sends hidden nudge to steer tutor response.

### Request
```json
{
  "nudge_text": "Student is getting frustrated; slow down and praise effort.",
  "parent_guidance": "Do not reveal this guidance.",
  "profile": {
    "age": 10,
    "grade": "5"
  },
  "daily_context": {
    "focus": "fractions"
  },
  "allow_direct_answer": false
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
  "model_used": "claude-3-5-sonnet-latest",
  "queued": true
}
```

### Errors
- `400 parent_nudge_failed`

## Visibility Rules
- Parent may read hidden guidance and parent-only events.
- Child must only receive child-safe tutor output and shared transcript lines.
- Parent guidance must never be echoed verbatim in child-visible content.

## Stability Notes
- These two endpoints are the initial stable contract for v1.
- Any response-shape change requires updates to tests, README, and handoff log.
