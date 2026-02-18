import { requireParentContext } from "../../../../src/server/auth.js";
import { listActiveSessionsForParent } from "../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";

export function createSessionActiveGetHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const listActiveSessions = dependencies.listActiveSessionsForParent ?? listActiveSessionsForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request) {
    try {
      const { parent } = await requireParent(request);
      await applyRateLimit(request, buildRateLimitPolicy("sessionActiveList", `parent:${parent.id}`));

      const sessions = await listActiveSessions(parent.id);
      return Response.json({ sessions });
    } catch (error) {
      return onError(error, "active_sessions_fetch_failed");
    }
  };
}

export const GET = createSessionActiveGetHandler();
