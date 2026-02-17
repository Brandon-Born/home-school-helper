import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { startSessionForParent } from "../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";

export function createSessionStartPostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const startSession = dependencies.startSessionForParent ?? startSessionForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      applyRateLimit(request, buildRateLimitPolicy("sessionStart"));

      const payload = await request.json();
      const { parent } = await requireParent(request);
      const session = await startSession(parent.id, payload);

      return Response.json({ session }, { status: 201 });
    } catch (error) {
      return onError(error, "session_start_failed");
    }
  };
}

export const POST = createSessionStartPostHandler();
