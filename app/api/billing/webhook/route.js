import { handleRouteError } from "../../../../src/server/route-errors.js";
import { processStripeWebhookEvent, verifyStripeWebhookEvent } from "../../../../src/server/billing-service.js";

export function createBillingWebhookPostHandler(dependencies = {}) {
  const verifyEvent = dependencies.verifyStripeWebhookEvent ?? verifyStripeWebhookEvent;
  const processEvent = dependencies.processStripeWebhookEvent ?? processStripeWebhookEvent;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      const payload = await request.text();
      const signature = request.headers.get("stripe-signature");
      const event = verifyEvent(payload, signature);
      const result = await processEvent(event);
      return Response.json({ ok: true, result });
    } catch (error) {
      return onError(error, "billing_webhook_failed");
    }
  };
}

export const POST = createBillingWebhookPostHandler();
