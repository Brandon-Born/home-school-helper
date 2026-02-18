import { requireParentContext } from "../../../../../src/server/auth.js";
import {
  endSessionForParent,
  regenerateJoinCodeForSession
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";

export function createSessionManagePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const endSession = dependencies.endSessionForParent ?? endSessionForParent;
  const regenerateCode = dependencies.regenerateJoinCodeForSession ?? regenerateJoinCodeForSession;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    try {
      const { id: sessionId } = await params;
      const { parent } = await requireParent(request);
      await applyRateLimit(
        request,
        buildRateLimitPolicy("sessionManage", `parent:${parent.id}:session:${sessionId}`)
      );
      const payload = await request.json();

      if (payload.action === "end") {
        const result = await endSession(parent.id, sessionId);
        return Response.json({ session: result });
      }

      if (payload.action === "regenerate_code") {
        const result = await regenerateCode(parent.id, sessionId);
        return Response.json(result);
      }

      return Response.json(
        { error: "invalid_action", message: "Action must be 'end' or 'regenerate_code'." },
        { status: 400 }
      );
    } catch (error) {
      return onError(error, "session_manage_failed");
    }
  };
}

export const POST = createSessionManagePostHandler();
