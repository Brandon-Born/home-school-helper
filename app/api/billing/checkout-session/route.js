import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { createStripeCheckoutSessionForParent } from "../../../../src/server/billing-service.js";

export function createBillingCheckoutSessionPostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const createCheckoutSession = dependencies.createStripeCheckoutSessionForParent ?? createStripeCheckoutSessionForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      const { parent } = await requireParent(request);
      const checkout = await createCheckoutSession(parent, { request });
      return Response.json({ checkout });
    } catch (error) {
      return onError(error, "billing_checkout_session_failed");
    }
  };
}

export const POST = createBillingCheckoutSessionPostHandler();
