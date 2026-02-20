import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  getParentCoppaConsentState,
  setParentCoppaConsentState
} from "../src/server/session-foundation-service.js";

function createMissingSchemaClient() {
  return {
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
        },
        update() {
          return this;
        },
        async single() {
          return {
            data: null,
            error: {
              message: "column coppa_consent_status does not exist"
            }
          };
        },
        insert() {
          return Promise.resolve({
            error: {
              message: "relation parent_consents does not exist"
            }
          });
        }
      };
    }
  };
}

test("getParentCoppaConsentState fails closed when COPPA schema is missing and fallback is disabled", async () => {
  const serviceClient = createMissingSchemaClient();

  await assert.rejects(
    () =>
      getParentCoppaConsentState("parent_1", {
        serviceClient,
        env: {
          NODE_ENV: "production",
          ALLOW_COPPA_SCHEMA_FALLBACK: "1"
        }
      }),
    (error) =>
      error instanceof ApiError &&
      error.status === 500 &&
      error.code === "coppa_consent_lookup_failed"
  );
});

test("getParentCoppaConsentState allows explicit non-production COPPA schema fallback", async () => {
  const serviceClient = createMissingSchemaClient();

  const consent = await getParentCoppaConsentState("parent_1", {
    serviceClient,
    env: {
      NODE_ENV: "test",
      ALLOW_COPPA_SCHEMA_FALLBACK: "1",
      COPPA_POLICY_VERSION: "2026-02-19",
      COPPA_POLICY_URL: "/privacy"
    }
  });

  assert.deepEqual(consent, {
    required: false,
    status: "granted",
    updated_at: null,
    policy_version: "2026-02-19",
    policy_url: "/privacy",
    method: null
  });
});

test("setParentCoppaConsentState fails closed when schema is missing and fallback is disabled", async () => {
  const serviceClient = createMissingSchemaClient();

  await assert.rejects(
    () =>
      setParentCoppaConsentState(
        "parent_1",
        {
          status: "granted"
        },
        {
          serviceClient,
          env: {
            NODE_ENV: "production",
            ALLOW_COPPA_SCHEMA_FALLBACK: "1"
          }
        }
      ),
    (error) =>
      error instanceof ApiError &&
      error.status === 500 &&
      error.code === "coppa_consent_update_failed"
  );
});

