import { handleRouteError } from "../../../../src/server/route-errors.js";
import { redeemSessionCode } from "../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";

export function createSessionJoinPostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const redeemCode = dependencies.redeemSessionCode ?? redeemSessionCode;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      applyRateLimit(request, buildRateLimitPolicy("sessionJoin"));

      const payload = await request.json();
      const sessionAccess = await redeemCode(payload);

      return Response.json({
        session_access: sessionAccess
      });
    } catch (error) {
      return onError(error, "session_join_failed");
    }
  };
}

export const POST = createSessionJoinPostHandler();
