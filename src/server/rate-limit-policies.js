const BASE_WINDOW_MS = 60_000;

export const RATE_LIMIT_POLICIES = Object.freeze({
  sessionJoin: Object.freeze({
    scope: "session_join",
    maxRequests: 10,
    windowMs: BASE_WINDOW_MS
  }),
  sessionStart: Object.freeze({
    scope: "session_start",
    maxRequests: 20,
    windowMs: BASE_WINDOW_MS
  }),
  childTurn: Object.freeze({
    scope: "child_turn",
    maxRequests: 45,
    windowMs: BASE_WINDOW_MS
  }),
  parentNudge: Object.freeze({
    scope: "parent_nudge",
    maxRequests: 30,
    windowMs: BASE_WINDOW_MS
  }),
  speechTranscribe: Object.freeze({
    scope: "speech_transcribe",
    maxRequests: 25,
    windowMs: BASE_WINDOW_MS
  }),
  speechSynthesize: Object.freeze({
    scope: "speech_synthesize",
    maxRequests: 35,
    windowMs: BASE_WINDOW_MS
  }),
  sessionStreamConnect: Object.freeze({
    scope: "session_stream_connect",
    maxRequests: 25,
    windowMs: BASE_WINDOW_MS
  }),
  sessionActiveList: Object.freeze({
    scope: "session_active_list",
    maxRequests: 45,
    windowMs: BASE_WINDOW_MS
  }),
  sessionManage: Object.freeze({
    scope: "session_manage",
    maxRequests: 30,
    windowMs: BASE_WINDOW_MS
  }),
  analyticsEvent: Object.freeze({
    scope: "analytics_event",
    maxRequests: 90,
    windowMs: BASE_WINDOW_MS
  }),
  privacyChildDataSummary: Object.freeze({
    scope: "privacy_child_data_summary",
    maxRequests: 30,
    windowMs: BASE_WINDOW_MS
  }),
  privacyRequestsList: Object.freeze({
    scope: "privacy_requests_list",
    maxRequests: 30,
    windowMs: BASE_WINDOW_MS
  }),
  privacyExportRequest: Object.freeze({
    scope: "privacy_export_request",
    maxRequests: 6,
    windowMs: BASE_WINDOW_MS
  }),
  privacyDeleteRequest: Object.freeze({
    scope: "privacy_delete_request",
    maxRequests: 4,
    windowMs: BASE_WINDOW_MS
  })
});

export function buildRateLimitPolicy(policyName, keySuffix = null) {
  const policy = RATE_LIMIT_POLICIES[policyName];
  if (!policy) {
    throw new Error(`Unknown rate limit policy: ${policyName}`);
  }

  if (keySuffix === null || keySuffix === undefined || keySuffix === "") {
    return policy;
  }

  return {
    ...policy,
    keySuffix
  };
}
