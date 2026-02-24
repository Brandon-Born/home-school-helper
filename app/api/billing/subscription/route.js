import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { getParentBillingSubscription } from "../../../../src/server/billing-service.js";

export function createBillingSubscriptionGetHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const getSubscription = dependencies.getParentBillingSubscription ?? getParentBillingSubscription;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request) {
    try {
      const { parent } = await requireParent(request);
      const billing = await getSubscription(parent.id);
      return Response.json({ billing });
    } catch (error) {
      return onError(error, "billing_subscription_fetch_failed");
    }
  };
}

export const GET = createBillingSubscriptionGetHandler();
