import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  assertCoppaSchemaReady,
  shouldRunCoppaStartupSchemaCheck
} from "../src/server/session-foundation/coppa-schema-health.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";

test("shouldRunCoppaStartupSchemaCheck defaults to production only", () => {
  assert.equal(shouldRunCoppaStartupSchemaCheck({ NODE_ENV: "production" }), true);
  assert.equal(shouldRunCoppaStartupSchemaCheck({ NODE_ENV: "test" }), false);
});

test("shouldRunCoppaStartupSchemaCheck respects explicit override", () => {
  assert.equal(shouldRunCoppaStartupSchemaCheck({ COPPA_STARTUP_SCHEMA_CHECK: "1" }), true);
  assert.equal(
    shouldRunCoppaStartupSchemaCheck({
      NODE_ENV: "production",
      COPPA_STARTUP_SCHEMA_CHECK: "0"
    }),
    false
  );
});

test("assertCoppaSchemaReady succeeds when COPPA columns/table are present", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [
      {
        id: "parent_1",
        coppa_consent_status: "granted",
        coppa_consent_updated_at: "2026-02-19T00:00:00.000Z",
        coppa_policy_version: "2026-02-19",
        coppa_consent_method: "parent_self_attestation"
      }
    ],
    parent_consents: []
  });

  await assert.doesNotReject(() => assertCoppaSchemaReady({ serviceClient }));
});

test("assertCoppaSchemaReady fails when parent COPPA columns are missing", async () => {
  const serviceClient = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return {
            data: null,
            error: {
              message: "column coppa_consent_status does not exist"
            }
          };
        }
      };
    }
  };

  await assert.rejects(
    () => assertCoppaSchemaReady({ serviceClient }),
    (error) => error instanceof ApiError && error.code === "coppa_schema_missing"
  );
});

test("assertCoppaSchemaReady fails when parent_consents table is missing", async () => {
  let call = 0;
  const serviceClient = {
    from() {
      call += 1;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: null,
            error: {
              message: "relation parent_consents does not exist"
            }
          });
        },
        async maybeSingle() {
          return {
            data: null,
            error: null
          };
        }
      };
    }
  };

  await assert.rejects(
    () => assertCoppaSchemaReady({ serviceClient }),
    (error) => error instanceof ApiError && error.code === "coppa_schema_missing" && call === 2
  );
});
