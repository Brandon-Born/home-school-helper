import { requireParentContext } from "../../../../src/server/auth.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { listPrivacyRequestsForParent } from "../../../../src/server/session-foundation-service.js";

export function createPrivacyRequestsGetHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const listRequests = dependencies.listPrivacyRequestsForParent ?? listPrivacyRequestsForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request) {
    try {
      const { parent } = await requireParent(request);
      await applyRateLimit(request, buildRateLimitPolicy("privacyRequestsList", `parent:${parent.id}`));
      const requests = await listRequests(parent.id);
      return Response.json({ requests });
    } catch (error) {
      return onError(error, "privacy_requests_failed");
    }
  };
}

export const GET = createPrivacyRequestsGetHandler();
