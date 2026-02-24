import { reconcileStripeBillingSubscriptions } from "../../../../../src/server/billing-service.js";
import { requireCronAuthorization } from "../../../../../src/server/cron-auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";

function parseBooleanQueryParam(value, fallbackValue = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallbackValue;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function parsePositiveIntegerQueryParam(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function createBillingReconcileCronGetHandler(scope, dependencies = {}) {
  const onError = dependencies.handleRouteError ?? handleRouteError;
  const authorize = dependencies.requireCronAuthorization ?? requireCronAuthorization;
  const reconcile = dependencies.reconcileStripeBillingSubscriptions ?? reconcileStripeBillingSubscriptions;
  const env = dependencies.env ?? process.env;

  return async function GET(request) {
    try {
      authorize(request, env);

      const url = new URL(request.url);
      const dryRun = parseBooleanQueryParam(url.searchParams.get("dry_run"));
      const limit = parsePositiveIntegerQueryParam(url.searchParams.get("limit"));

      const result = await reconcile({
        env,
        scope,
        dryRun,
        ...(limit ? { limit } : {})
      });

      return Response.json({
        ok: true,
        mode: scope,
        result
      });
    } catch (error) {
      return onError(error, "billing_reconcile_cron_failed");
    }
  };
}

