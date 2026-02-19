import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { getChildDataSummaryForParent } from "../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";

export function createPrivacyChildDataSummaryGetHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const summarizeChildData = dependencies.getChildDataSummaryForParent ?? getChildDataSummaryForParent;
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request) {
    try {
      const { parent } = await requireParent(request);
      await applyRateLimit(request, buildRateLimitPolicy("privacyChildDataSummary", `parent:${parent.id}`));
      const summary = await summarizeChildData(parent.id);
      return Response.json({ summary });
    } catch (error) {
      return onError(error, "privacy_child_data_summary_failed");
    }
  };
}

export const GET = createPrivacyChildDataSummaryGetHandler();
