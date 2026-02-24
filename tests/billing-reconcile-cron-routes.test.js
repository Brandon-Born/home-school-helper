import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createBillingReconcileCronGetHandler } from "../app/api/internal/billing/reconcile/_shared.js";
import { assertApiErrorResponse } from "./helpers/route-test-helpers.js";

test("createBillingReconcileCronGetHandler requires cron authorization", async () => {
  const handler = createBillingReconcileCronGetHandler("problem", {
    requireCronAuthorization: () => {
      throw new ApiError(401, "invalid_cron_secret", "Invalid cron authorization.");
    }
  });

  const response = await handler(new Request("https://example.test/api/internal/billing/reconcile/hourly"));

  await assertApiErrorResponse(response, {
    status: 401,
    error: "invalid_cron_secret",
    message: "Invalid cron authorization."
  });
});

test("createBillingReconcileCronGetHandler runs reconciliation with parsed query options", async () => {
  let recordedOptions = null;
  const handler = createBillingReconcileCronGetHandler("full", {
    requireCronAuthorization: () => {},
    reconcileStripeBillingSubscriptions: async (options) => {
      recordedOptions = options;
      return { scope: options.scope, dry_run: options.dryRun, scanned: 5 };
    },
    env: { CRON_SECRET: "test-secret" }
  });

  const response = await handler(
    new Request("https://example.test/api/internal/billing/reconcile/nightly?dry_run=1&limit=50")
  );

  assert.equal(response.status, 200);
  assert.deepEqual(recordedOptions, {
    env: { CRON_SECRET: "test-secret" },
    scope: "full",
    dryRun: true,
    limit: 50
  });

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, "full");
  assert.equal(payload.result.scanned, 5);
});
