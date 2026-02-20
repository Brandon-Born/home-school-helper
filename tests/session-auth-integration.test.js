import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { requireChildSessionContext, requireParentContext } from "../src/server/auth.js";
import {
  createChildForParent,
  endSessionForParent,
  ensureParentOwnsSession,
  listActiveSessionsForParent,
  listSessionMessages,
  regenerateJoinCodeForSession,
  redeemSessionCode,
  setParentCoppaConsentState,
  startSessionForParent
} from "../src/server/session-foundation-service.js";
import { hashOpaqueToken } from "../src/server/session-codes.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";

function buildConsentReadyParent(overrides = {}) {
  return {
    id: "parent_1",
    auth_user_id: "auth_parent_1",
    email: "parent@example.com",
    full_name: "Parent One",
    onboarding_completed: false,
    coppa_consent_status: "granted",
    coppa_consent_updated_at: "2026-02-19T00:00:00.000Z",
    coppa_policy_version: "2026-02-19",
    coppa_consent_method: "parent_self_attestation",
    created_at: "2026-02-19T00:00:00.000Z",
    ...overrides
  };
}

test("redeemSessionCode redeems exactly once and creates child session token", async () => {
  const now = Date.now();
  const code = "AB12CD34";
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        status: "active"
      }
    ],
    session_codes: [
      {
        id: "code_1",
        session_id: "session_1",
        code_hash: hashOpaqueToken(code),
        expires_at: new Date(now + 5 * 60 * 1000).toISOString(),
        redeemed_at: null,
        redeemed_device_fingerprint: null
      }
    ]
  });

  const first = await redeemSessionCode(
    { code: "ab12-cd34", device_fingerprint: "device-xyz" },
    { serviceClient }
  );

  assert.equal(first.session_id, "session_1");
  assert.equal(first.child_id, "child_1");
  assert.equal(typeof first.child_session_token, "string");
  assert.ok(first.child_session_token.length >= 20);

  assert.equal(serviceClient.tables.session_codes[0].redeemed_device_fingerprint, "device-xyz");
  assert.notEqual(serviceClient.tables.session_codes[0].redeemed_at, null);
  assert.equal(serviceClient.tables.child_session_tokens.length, 1);
  assert.equal(
    serviceClient.tables.child_session_tokens[0].token_hash,
    hashOpaqueToken(first.child_session_token)
  );

  await assert.rejects(
    () => redeemSessionCode({ code }, { serviceClient }),
    (error) => error instanceof ApiError && error.status === 409 && error.code === "session_code_used"
  );
});

test("startSessionForParent returns UI metadata needed for active-session cards", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent()],
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava"
      }
    ]
  });

  const session = await startSessionForParent(
    "parent_1",
    {
      child_id: "child_1",
      daily_subjects: ["Math"],
      parent_context: "Keep it short."
    },
    { serviceClient }
  );

  assert.equal(session.child_name, "Ava");
  assert.equal(typeof session.started_at, "string");
  assert.equal(Number.isNaN(new Date(session.started_at).getTime()), false);
  assert.equal(typeof session.join_code, "string");
  assert.equal(session.join_code.length, 8);
});

test("ensureParentOwnsSession enforces parent/session ownership", async () => {
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        parent_id: "parent_1",
        status: "active"
      }
    ]
  });

  const owned = await ensureParentOwnsSession("parent_1", "session_1", { serviceClient });
  assert.equal(owned.id, "session_1");

  await assert.rejects(
    () => ensureParentOwnsSession("parent_2", "session_1", { serviceClient }),
    (error) => error instanceof ApiError && error.status === 404 && error.code === "session_not_found"
  );
});

test("listSessionMessages hides parent-only messages from child visibility", async () => {
  const serviceClient = createFakeServiceClient({
    messages: [
      {
        id: "m1",
        session_id: "session_1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "Need help with fractions",
        policy_flags: [],
        created_at: "2026-02-17T04:00:00.000Z"
      },
      {
        id: "m2",
        session_id: "session_1",
        actor_type: "parent",
        visibility_scope: "parent_only",
        content: "Keep it confidence-building",
        policy_flags: [],
        created_at: "2026-02-17T04:00:01.000Z"
      },
      {
        id: "m3",
        session_id: "session_1",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "Let us break this down together.",
        policy_flags: ["scaffold_first"],
        created_at: "2026-02-17T04:00:02.000Z"
      },
      {
        id: "m4",
        session_id: "session_2",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "Other session",
        policy_flags: [],
        created_at: "2026-02-17T04:00:03.000Z"
      }
    ]
  });

  const parentView = await listSessionMessages(
    { sessionId: "session_1", visibility: "all", limit: 50 },
    { serviceClient }
  );
  assert.equal(parentView.length, 3);

  const childView = await listSessionMessages(
    { sessionId: "session_1", visibility: "child", limit: 50 },
    { serviceClient }
  );

  assert.equal(childView.length, 2);
  assert.deepEqual(
    childView.map((message) => message.id),
    ["m1", "m3"]
  );
});

test("requireChildSessionContext validates token hash, session scope, and expiry", async () => {
  const token = "child-secret-token";
  const serviceClient = createFakeServiceClient({
    child_session_tokens: [
      {
        id: "token_1",
        session_id: "session_1",
        child_id: "child_1",
        token_hash: hashOpaqueToken(token),
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
        revoked_at: null
      }
    ]
  });

  const request = new Request("https://example.test/api/session/session_1/child-turn", {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const context = await requireChildSessionContext(request, "session_1", { serviceClient });
  assert.equal(context.tokenRow.id, "token_1");

  await assert.rejects(
    () => requireChildSessionContext(request, "session_2", { serviceClient }),
    (error) =>
      error instanceof ApiError && error.status === 401 && error.code === "invalid_child_session_token"
  );

  serviceClient.tables.child_session_tokens[0].expires_at = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(
    () => requireChildSessionContext(request, "session_1", { serviceClient }),
    (error) =>
      error instanceof ApiError && error.status === 401 && error.code === "invalid_child_session_token"
  );
});

test("requireChildSessionContext enforces active session when requested", async () => {
  const token = "child-secret-token";
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        parent_id: "parent_1",
        status: "ended"
      }
    ],
    child_session_tokens: [
      {
        id: "token_1",
        session_id: "session_1",
        child_id: "child_1",
        token_hash: hashOpaqueToken(token),
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
        revoked_at: null
      }
    ]
  });

  const request = new Request("https://example.test/api/session/session_1/speech/transcribe", {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  await assert.rejects(
    () => requireChildSessionContext(request, "session_1", { serviceClient, requireActiveSession: true }),
    (error) => error instanceof ApiError && error.status === 409 && error.code === "session_not_active"
  );
});

test("requireParentContext validates bearer token and upserts parent record", async () => {
  const serviceClient = createFakeServiceClient();
  const anonClient = {
    auth: {
      getUser: async (accessToken) => {
        if (accessToken === "bad-token") {
          return {
            data: { user: null },
            error: { message: "Invalid JWT" }
          };
        }

        return {
          data: {
            user: {
              id: "auth_parent_1",
              email: "parent@example.com",
              user_metadata: {
                full_name: "Parent One"
              }
            }
          },
          error: null
        };
      }
    }
  };

  const validRequest = new Request("https://example.test/api/parent/me", {
    headers: {
      authorization: "Bearer good-token"
    }
  });

  const context = await requireParentContext(validRequest, {
    anonClient,
    serviceClient
  });

  assert.equal(context.parent.auth_user_id, "auth_parent_1");
  assert.equal(context.parent.email, "parent@example.com");
  assert.equal(serviceClient.tables.parents.length, 1);

  const invalidRequest = new Request("https://example.test/api/parent/me", {
    headers: {
      authorization: "Bearer bad-token"
    }
  });

  await assert.rejects(
    () => requireParentContext(invalidRequest, { anonClient, serviceClient }),
    (error) => error instanceof ApiError && error.status === 401 && error.code === "invalid_parent_token"
  );

  await requireParentContext(validRequest, { anonClient, serviceClient });
  assert.equal(serviceClient.tables.parents.length, 1);
});

test("listActiveSessionsForParent returns active join code metadata", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent()],
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava"
      }
    ]
  });

  const started = await startSessionForParent(
    "parent_1",
    {
      child_id: "child_1",
      daily_subjects: ["Math"]
    },
    { serviceClient }
  );

  const sessions = await listActiveSessionsForParent("parent_1", { serviceClient });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].join_code, started.join_code);
  assert.equal(typeof sessions[0].expires_at, "string");
});

test("regenerateJoinCodeForSession refreshes session metadata and expires prior code", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent()],
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava"
      }
    ]
  });

  const started = await startSessionForParent(
    "parent_1",
    {
      child_id: "child_1",
      daily_subjects: ["Math"]
    },
    { serviceClient }
  );
  const startedHash = hashOpaqueToken(started.join_code);

  const regenerated = await regenerateJoinCodeForSession("parent_1", started.session_id, { serviceClient });
  assert.notEqual(regenerated.join_code, started.join_code);

  const sessionRow = serviceClient.tables.sessions.find((row) => row.id === started.session_id);
  assert.equal(sessionRow.active_join_code, regenerated.join_code);
  assert.equal(sessionRow.active_join_code_expires_at, regenerated.expires_at);

  const previousCodeRow = serviceClient.tables.session_codes.find((row) => row.code_hash === startedHash);
  assert.ok(previousCodeRow);
  assert.equal(new Date(previousCodeRow.expires_at).getTime() <= Date.now(), true);

  const sessions = await listActiveSessionsForParent("parent_1", { serviceClient });
  assert.equal(sessions[0].join_code, regenerated.join_code);
});

test("endSessionForParent revokes non-expired child session tokens", async () => {
  const now = Date.now();
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        parent_id: "parent_1",
        status: "active"
      }
    ],
    child_session_tokens: [
      {
        id: "token_active",
        session_id: "session_1",
        child_id: "child_1",
        token_hash: "hash-active",
        expires_at: new Date(now + 60 * 1000).toISOString(),
        revoked_at: null
      },
      {
        id: "token_expired",
        session_id: "session_1",
        child_id: "child_1",
        token_hash: "hash-expired",
        expires_at: new Date(now - 60 * 1000).toISOString(),
        revoked_at: null
      },
      {
        id: "token_already_revoked",
        session_id: "session_1",
        child_id: "child_1",
        token_hash: "hash-revoked",
        expires_at: new Date(now + 120 * 1000).toISOString(),
        revoked_at: new Date(now - 10 * 1000).toISOString()
      }
    ]
  });

  const ended = await endSessionForParent("parent_1", "session_1", { serviceClient });
  assert.equal(ended.status, "ended");

  const activeToken = serviceClient.tables.child_session_tokens.find((row) => row.id === "token_active");
  const expiredToken = serviceClient.tables.child_session_tokens.find((row) => row.id === "token_expired");
  const revokedToken = serviceClient.tables.child_session_tokens.find((row) => row.id === "token_already_revoked");

  assert.ok(activeToken.revoked_at);
  assert.equal(expiredToken.revoked_at, null);
  assert.ok(revokedToken.revoked_at);
});

test("redeemSessionCode clears active join-code metadata from session list", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent()],
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava"
      }
    ]
  });

  const started = await startSessionForParent(
    "parent_1",
    {
      child_id: "child_1",
      daily_subjects: ["Reading"]
    },
    { serviceClient }
  );

  await redeemSessionCode({ code: started.join_code }, { serviceClient });
  const sessions = await listActiveSessionsForParent("parent_1", { serviceClient });

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].join_code, null);
  assert.equal(sessions[0].expires_at, null);
});

test("startSessionForParent blocks when parental consent is pending", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent({ coppa_consent_status: "pending", coppa_consent_method: null })],
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava"
      }
    ]
  });

  await assert.rejects(
    () =>
      startSessionForParent(
        "parent_1",
        {
          child_id: "child_1",
          daily_subjects: ["Math"]
        },
        { serviceClient }
      ),
    (error) =>
      error instanceof ApiError && error.status === 403 && error.code === "coppa_consent_required"
  );
});

test("setParentCoppaConsentState writes parent status and audit event", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent({ coppa_consent_status: "pending", coppa_consent_method: null })]
  });

  const consent = await setParentCoppaConsentState(
    "parent_1",
    { status: "granted" },
    {
      serviceClient,
      request: new Request("https://example.test/api/privacy/consent", {
        headers: {
          "user-agent": "unit-test-agent",
          "x-forwarded-for": "203.0.113.1"
        }
      })
    }
  );

  assert.equal(consent.status, "granted");
  assert.equal(serviceClient.tables.parents[0].coppa_consent_status, "granted");
  assert.equal(serviceClient.tables.parent_consents.length, 1);
  assert.equal(serviceClient.tables.parent_consents[0].status, "granted");
  assert.equal(serviceClient.tables.parent_consents[0].client_address, "203.0.113.1");
});

test("createChildForParent blocks when parental consent is revoked", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildConsentReadyParent({ coppa_consent_status: "revoked" })]
  });

  await assert.rejects(
    () =>
      createChildForParent(
        "parent_1",
        {
          child_name: "Ava",
          age: 9,
          grade: "4",
          subjects: ["Math"]
        },
        { serviceClient }
      ),
    (error) =>
      error instanceof ApiError && error.status === 403 && error.code === "coppa_consent_required"
  );
});
