import { handleRouteError } from "../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../src/server/rate-limit-policies.js";
import { logProductAnalyticsEvent, normalizeProductAnalyticsEvent } from "../../../../src/server/product-analytics.js";

export function createAnalyticsEventPostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const normalizeEvent = dependencies.normalizeProductAnalyticsEvent ?? normalizeProductAnalyticsEvent;
  const logEvent = dependencies.logProductAnalyticsEvent ?? logProductAnalyticsEvent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      await applyRateLimit(request, buildRateLimitPolicy("analyticsEvent"));

      const input = await request.json();
      const { event, payload } = normalizeEvent(input);
      logEvent(event, payload);

      return Response.json({ accepted: true }, { status: 202 });
    } catch (error) {
      return onError(error, "analytics_event_failed");
    }
  };
}

export const POST = createAnalyticsEventPostHandler();
