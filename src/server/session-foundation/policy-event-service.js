import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

export async function persistPolicyEvent(
  { sessionId, eventType, actionTaken, metadata = {} },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const normalizedEventType = String(eventType || "").trim();
  const normalizedAction = String(actionTaken || "").trim();

  if (!normalizedEventType) {
    throw new ApiError(400, "validation_error", "eventType is required.");
  }

  if (!normalizedAction) {
    throw new ApiError(400, "validation_error", "actionTaken is required.");
  }

  const { error } = await serviceClient.from("policy_events").insert({
    session_id: sessionId,
    event_type: normalizedEventType,
    action_taken: normalizedAction,
    metadata: metadata && typeof metadata === "object" ? metadata : {}
  });

  if (error) {
    throw new ApiError(500, "policy_event_persist_failed", "Unable to persist policy audit event.");
  }
}

export async function persistTutorAuditEvents(
  { sessionId, source, modelUsed, promptVersion, policyApplied = [] },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const policyActions = Array.isArray(policyApplied)
    ? policyApplied
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  const rows = [
    {
      session_id: sessionId,
      event_type: "tutor_model_call",
      action_taken: "model_response_generated",
      metadata: {
        route: source ?? null,
        model_used: modelUsed ?? null,
        prompt_version: promptVersion ?? null
      }
    },
    ...policyActions.map((action) => ({
      session_id: sessionId,
      event_type: "guardrail_policy",
      action_taken: action,
      metadata: {
        route: source ?? null
      }
    }))
  ];

  const { error } = await serviceClient.from("policy_events").insert(rows);
  if (error) {
    throw new ApiError(500, "policy_event_persist_failed", "Unable to persist tutor audit events.");
  }
}
