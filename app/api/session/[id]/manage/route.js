import { requireParentContext } from "../../../../../src/server/auth.js";
import {
  endSessionForParent,
  regenerateJoinCodeForSession
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { runSessionRoute } from "../../../../../src/server/session-route-helpers.js";

export function createSessionManagePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const endSession = dependencies.endSessionForParent ?? endSessionForParent;
  const regenerateCode = dependencies.regenerateJoinCodeForSession ?? regenerateJoinCodeForSession;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    return runSessionRoute({
      request,
      params,
      fallbackCode: "session_manage_failed",
      onError,
      run: async ({ sessionId }) => {
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
      }
    });
  };
}

export const POST = createSessionManagePostHandler();
