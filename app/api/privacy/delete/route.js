import { ApiError } from "../../../../src/server/api-error.js";
import { requireParentContext } from "../../../../src/server/auth.js";
import { getClientAddress, enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import {
  PRIVACY_REQUEST_TYPES,
  createPrivacyRequestForParent,
  markPrivacyRequestCompleted,
  markPrivacyRequestFailed,
  deleteChildDataForParent
} from "../../../../src/server/session-foundation-service.js";

const DELETE_CONFIRM_PHRASE = "DELETE CHILD DATA";

function validateDeletePayload(payload) {
  const phrase = String(payload?.confirm_phrase ?? "").trim().toUpperCase();
  if (phrase !== DELETE_CONFIRM_PHRASE) {
    throw new ApiError(400, "validation_error", `confirm_phrase must exactly match "${DELETE_CONFIRM_PHRASE}".`);
  }
}

export function createPrivacyDeletePostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const createRequest = dependencies.createPrivacyRequestForParent ?? createPrivacyRequestForParent;
  const completeRequest = dependencies.markPrivacyRequestCompleted ?? markPrivacyRequestCompleted;
  const failRequest = dependencies.markPrivacyRequestFailed ?? markPrivacyRequestFailed;
  const deleteChildData = dependencies.deleteChildDataForParent ?? deleteChildDataForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    let requestRow = null;

    try {
      const { parent } = await requireParent(request);
      await applyRateLimit(request, buildRateLimitPolicy("privacyDeleteRequest", `parent:${parent.id}`));
      const payload = await request.json().catch(() => ({}));
      validateDeletePayload(payload);

      requestRow = await createRequest(parent.id, {
        request_type: PRIVACY_REQUEST_TYPES.delete,
        reason: payload.reason,
        actor_parent_id: parent.id,
        client_address: getClientAddress(request),
        user_agent: request.headers.get("user-agent")
      });

      const deletion = await deleteChildData(parent.id);
      const completed = await completeRequest(requestRow.id, deletion);

      return Response.json({
        request: completed,
        deletion
      });
    } catch (error) {
      if (requestRow?.id) {
        const message = error instanceof Error ? error.message : "Unknown delete failure";
        try {
          await failRequest(requestRow.id, message);
        } catch {
          // Ignore secondary failure; primary error still returned via route handler.
        }
      }

      return onError(error, "privacy_delete_failed");
    }
  };
}

export const POST = createPrivacyDeletePostHandler();
