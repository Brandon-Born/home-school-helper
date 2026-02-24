import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { createStripeBillingPortalSessionForParent } from "../../../../src/server/billing-service.js";

export function createBillingPortalSessionPostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const createPortalSession = dependencies.createStripeBillingPortalSessionForParent ?? createStripeBillingPortalSessionForParent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      const { parent } = await requireParent(request);
      const portal = await createPortalSession(parent.id, { request });
      return Response.json({ portal });
    } catch (error) {
      return onError(error, "billing_portal_session_failed");
    }
  };
}

export const POST = createBillingPortalSessionPostHandler();
