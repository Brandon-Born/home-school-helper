import Stripe from "stripe";
import { getStripeBillingConfig } from "./billing-config.js";

let cachedClient;

export function getStripeClient(env = process.env) {
  if (env === process.env && cachedClient) {
    return cachedClient;
  }

  const config = getStripeBillingConfig(env);
  if (!config.enabled) {
    throw new Error("Billing is disabled.");
  }

  const client = new Stripe(config.stripe.secretKey);

  if (env === process.env) {
    cachedClient = client;
  }

  return client;
}

export function resetStripeClientCache() {
  cachedClient = undefined;
}
