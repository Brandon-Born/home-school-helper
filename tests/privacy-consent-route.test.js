import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  createPrivacyConsentGetHandler,
  createPrivacyConsentPostHandler
} from "../app/api/privacy/consent/route.js";
import { assertApiErrorResponse, createJsonRequest } from "./helpers/route-test-helpers.js";

test("createPrivacyConsentGetHandler returns consent state for authenticated parent", async () => {
  let recordedParentId = null;
  const handler = createPrivacyConsentGetHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    getParentCoppaConsentState: async (parentId) => {
      recordedParentId = parentId;
      return {
        required: true,
        status: "pending",
        updated_at: null,
        policy_version: "2026-02-19",
        policy_url: "/privacy",
        method: null
      };
    }
  });

  const response = await handler(new Request("https://example.test/api/privacy/consent", { method: "GET" }));
  assert.equal(response.status, 200);
  assert.equal(recordedParentId, "parent_1");
  const body = await response.json();
  assert.deepEqual(body, {
    consent: {
      required: true,
      status: "pending",
      updated_at: null,
      policy_version: "2026-02-19",
      policy_url: "/privacy",
      method: null
    }
  });
});

test("createPrivacyConsentPostHandler rejects invalid action payload", async () => {
  const handler = createPrivacyConsentPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    })
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/privacy/consent", { action: "approve" })
  );

  await assertApiErrorResponse(response, {
    status: 400,
    error: "validation_error",
    message: "Action must be 'grant' or 'revoke'."
  });
});

test("createPrivacyConsentPostHandler stores granted consent with request metadata", async () => {
  let recordedArgs = null;
  const handler = createPrivacyConsentPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    setParentCoppaConsentState: async (parentId, payload, options) => {
      recordedArgs = { parentId, payload, options };
      return {
        required: true,
        status: "granted",
        updated_at: "2026-02-19T12:00:00.000Z",
        policy_version: "2026-02-19",
        policy_url: "/privacy",
        method: "parent_self_attestation"
      };
    }
  });

  const response = await handler(
    createJsonRequest(
      "https://example.test/api/privacy/consent",
      { action: "grant" },
      {
        headers: {
          "user-agent": "unit-test-agent",
          "x-forwarded-for": "198.51.100.10"
        }
      }
    )
  );

  assert.equal(response.status, 200);
  assert.equal(recordedArgs.parentId, "parent_1");
  assert.equal(recordedArgs.payload.status, "granted");
  assert.equal(recordedArgs.payload.actorParentId, "parent_1");
  assert.ok(recordedArgs.options.request instanceof Request);

  const body = await response.json();
  assert.equal(body.consent.status, "granted");
});

test("createPrivacyConsentPostHandler blocks self-attestation grant when billing-backed flow is required", async () => {
  const handler = createPrivacyConsentPostHandler({
    allowSelfAttestationConsentGrant: false,
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    })
  });

  const response = await handler(createJsonRequest("https://example.test/api/privacy/consent", { action: "grant" }));

  await assertApiErrorResponse(response, {
    status: 409,
    error: "billing_required_for_coppa_grant",
    message: "Complete parent payment verification to grant parental consent."
  });
});

test("createPrivacyConsentPostHandler returns route errors from consent service", async () => {
  const handler = createPrivacyConsentPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    setParentCoppaConsentState: async () => {
      throw new ApiError(500, "coppa_consent_update_failed", "Unable to update parental consent status.");
    }
  });

  const response = await handler(createJsonRequest("https://example.test/api/privacy/consent", { action: "grant" }));

  await assertApiErrorResponse(response, {
    status: 500,
    error: "coppa_consent_update_failed",
    message: "Unable to update parental consent status."
  });
});
