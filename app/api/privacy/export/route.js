import { requireParentContext } from "../../../../src/server/auth.js";
import { getClientAddress, enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import {
  PRIVACY_REQUEST_TYPES,
  createPrivacyRequestForParent,
  markPrivacyRequestCompleted,
  markPrivacyRequestFailed,
  generateExportSnapshotForParent
} from "../../../../src/server/session-foundation-service.js";

export function createPrivacyExportPostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const createRequest = dependencies.createPrivacyRequestForParent ?? createPrivacyRequestForParent;
  const completeRequest = dependencies.markPrivacyRequestCompleted ?? markPrivacyRequestCompleted;
  const failRequest = dependencies.markPrivacyRequestFailed ?? markPrivacyRequestFailed;
  const generateExport = dependencies.generateExportSnapshotForParent ?? generateExportSnapshotForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    let requestRow = null;

    try {
      const { parent } = await requireParent(request);
      await applyRateLimit(request, buildRateLimitPolicy("privacyExportRequest", `parent:${parent.id}`));
      const payload = await request.json().catch(() => ({}));

      requestRow = await createRequest(parent.id, {
        request_type: PRIVACY_REQUEST_TYPES.export,
        reason: payload.reason,
        actor_parent_id: parent.id,
        client_address: getClientAddress(request),
        user_agent: request.headers.get("user-agent")
      });

      const snapshot = await generateExport(parent.id);

      const completed = await completeRequest(requestRow.id, {
        counts: snapshot.summary?.counts ?? {},
        generated_at: snapshot.generated_at
      });

      return Response.json({
        request: completed,
        export_snapshot: snapshot
      });
    } catch (error) {
      if (requestRow?.id) {
        const message = error instanceof Error ? error.message : "Unknown export failure";
        try {
          await failRequest(requestRow.id, message);
        } catch {
          // Ignore secondary failure; primary error still returned via route handler.
        }
      }

      return onError(error, "privacy_export_failed");
    }
  };
}

export const POST = createPrivacyExportPostHandler();
