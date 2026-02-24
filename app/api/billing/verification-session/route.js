import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { createStripeParentVerificationSessionForParent } from "../../../../src/server/billing-service.js";

export function createBillingVerificationSessionPostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const createVerificationSession =
    dependencies.createStripeParentVerificationSessionForParent ?? createStripeParentVerificationSessionForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      const { parent } = await requireParent(request);
      const verification = await createVerificationSession(parent, { request });
      return Response.json({ verification });
    } catch (error) {
      return onError(error, "billing_verification_session_failed");
    }
  };
}

export const POST = createBillingVerificationSessionPostHandler();
