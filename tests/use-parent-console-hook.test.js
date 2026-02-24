import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";

import { createUseParentConsole } from "../app/parent/hooks/useParentConsole.js";
import { createHookRenderer, flushEffects } from "./helpers/hook-test-renderer.js";

function createSessionFixture(overrides = {}) {
  return {
    session_id: "session_1",
    child_id: "child_1",
    child_name: "Ava",
    started_at: "2026-02-18T00:00:00.000Z",
    join_code: "OLDCODE1",
    expires_at: "2026-02-18T01:00:00.000Z",
    ...overrides
  };
}

test("useParentConsole merges snapshot+append stream events", async () => {
  let streamArgs = null;
  const parentRequest = async (path) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1" } };
    }
    if (path === "/api/children") {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [createSessionFixture()] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary: { generated_at: "2026-02-19T00:00:00.000Z", counts: { children: 1, sessions: 1 } } };
    }
    if (path === "/api/privacy/requests") {
      return { requests: [] };
    }
    throw new Error(`Unexpected path: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: (args) => {
      streamArgs = args;
    }
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  await act(async () => {
    streamArgs.onSnapshot([
      {
        id: "m1",
        content: "hello",
        created_at: "2026-02-18T00:00:00.000Z"
      }
    ]);
  });
  await act(async () => {
    streamArgs.onAppend([
      {
        id: "m2",
        content: "world",
        created_at: "2026-02-18T00:00:01.000Z"
      }
    ]);
  });

  const hookValue = renderer.getCurrent();
  assert.deepEqual(
    hookValue.state.messages.map((message) => message.id),
    ["m1", "m2"]
  );

  await renderer.unmount();
});

test("useParentConsole loads billing state when billing endpoint is available", async () => {
  const parentRequest = async (path) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1", coppa_consent_status: "pending", coppa_policy_version: "2026-02-19" } };
    }
    if (path === "/api/children") {
      return { children: [] };
    }
    if (path === "/api/session/active") {
      return { sessions: [] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary: { generated_at: "2026-02-19T00:00:00.000Z", counts: { children: 0, sessions: 0 } } };
    }
    if (path === "/api/privacy/requests") {
      return { requests: [] };
    }
    if (path === "/api/billing/subscription") {
      return {
        billing: {
          enabled: true,
          provider: "stripe",
          subscription: {
            status: "trialing",
            trial_end_at: "2026-02-26T00:00:00.000Z",
            provider_customer_id: "cus_123"
          }
        }
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  const hookValue = renderer.getCurrent();
  assert.equal(hookValue.state.billingEnabled, true);
  assert.equal(hookValue.state.billing.provider, "stripe");
  assert.equal(hookValue.state.billingSubscription.status, "trialing");

  await renderer.unmount();
});

test("useParentConsole regenerateCode updates active session data and loading state", async () => {
  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1" } };
    }
    if (path === "/api/children") {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [createSessionFixture()] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary: { generated_at: "2026-02-19T00:00:00.000Z", counts: { children: 1, sessions: 1 } } };
    }
    if (path === "/api/privacy/requests") {
      return { requests: [] };
    }
    if (path === "/api/session/session_1/manage" && options.body?.action === "regenerate_code") {
      return {
        session_id: "session_1",
        join_code: "NEWCODE9",
        expires_at: "2026-02-18T02:00:00.000Z"
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  const initial = renderer.getCurrent();
  await act(async () => {
    initial.actions.rejoinSession(initial.state.activeSessions[0]);
  });

  await act(async () => {
    await renderer.getCurrent().actions.regenerateCode("session_1");
  });

  const hookValue = renderer.getCurrent();
  assert.equal(hookValue.state.loading.sessionManage, false);
  assert.equal(hookValue.state.activeSession.join_code, "NEWCODE9");
  assert.equal(hookValue.state.activeSessions[0].join_code, "NEWCODE9");
  assert.equal(hookValue.state.actionAlerts.sessionManage.tone, "success");
  assert.equal(hookValue.state.actionAlerts.sessionManage.message, "Join code refreshed.");

  await renderer.unmount();
});

test("useParentConsole exposes child mutation error feedback for inline panel messaging", async () => {
  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1" } };
    }
    if (path === "/api/children" && !options.method) {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary: { generated_at: "2026-02-19T00:00:00.000Z", counts: { children: 1, sessions: 0 } } };
    }
    if (path === "/api/privacy/requests") {
      return { requests: [] };
    }
    if (path === "/api/children" && options.method === "POST") {
      throw new Error("Child save failed.");
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  await act(async () => {
    renderer.getCurrent().actions.setChildForm((previous) => ({
      ...previous,
      child_name: "Ava",
      age: "9",
      subjects: "math"
    }));
  });

  let saved = null;
  await act(async () => {
    saved = await renderer.getCurrent().actions.createChild({
      preventDefault() {}
    });
  });

  const hookValue = renderer.getCurrent();
  assert.equal(saved, false);
  assert.equal(hookValue.state.loading.childMutation, false);
  assert.equal(hookValue.state.actionAlerts.childMutation.tone, "error");
  assert.equal(hookValue.state.actionAlerts.childMutation.message, "Child save failed.");

  await renderer.unmount();
});

test("useParentConsole grantCoppaConsent updates parent profile consent state", async () => {
  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return {
        parent: {
          id: "parent_1",
          coppa_consent_status: "pending",
          coppa_policy_version: "2026-02-19"
        }
      };
    }
    if (path === "/api/children") {
      return { children: [] };
    }
    if (path === "/api/session/active") {
      return { sessions: [] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary: { generated_at: "2026-02-19T00:00:00.000Z", counts: { children: 0, sessions: 0 } } };
    }
    if (path === "/api/privacy/requests") {
      return { requests: [] };
    }
    if (path === "/api/privacy/consent" && options.method === "POST" && options.body?.action === "grant") {
      return {
        consent: {
          required: true,
          status: "granted",
          updated_at: "2026-02-19T12:00:00.000Z",
          policy_version: "2026-02-19",
          policy_url: "/privacy",
          method: "parent_self_attestation"
        }
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  assert.equal(renderer.getCurrent().state.hasCoppaConsent, false);

  await act(async () => {
    await renderer.getCurrent().actions.grantCoppaConsent();
  });

  const hookValue = renderer.getCurrent();
  assert.equal(hookValue.state.hasCoppaConsent, true);
  assert.equal(hookValue.state.loading.consent, false);
  assert.equal(hookValue.state.actionAlerts.consent.tone, "success");
  assert.equal(hookValue.state.actionAlerts.consent.message, "Parental consent confirmed.");

  await renderer.unmount();
});

test("useParentConsole grantCoppaConsent starts parent verification when billing is enabled", async () => {
  let verificationRequested = false;
  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return {
        parent: {
          id: "parent_1",
          coppa_consent_status: "pending",
          coppa_policy_version: "2026-02-19"
        }
      };
    }
    if (path === "/api/children") {
      return { children: [] };
    }
    if (path === "/api/session/active") {
      return { sessions: [] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary: { generated_at: "2026-02-19T00:00:00.000Z", counts: { children: 0, sessions: 0 } } };
    }
    if (path === "/api/privacy/requests") {
      return { requests: [] };
    }
    if (path === "/api/billing/subscription") {
      return { billing: { enabled: true, provider: "stripe", subscription: null } };
    }
    if (path === "/api/billing/verification-session" && options.method === "POST") {
      verificationRequested = true;
      return {
        verification: {
          id: "cs_test_verify_123",
          url: "http://localhost/parent?billing=verification_success",
          verification_amount_cents: 100
        }
      };
    }

    throw new Error(`Unexpected request: ${path}`);
  };

  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  await act(async () => {
    await renderer.getCurrent().actions.grantCoppaConsent();
  });

  const hookValue = renderer.getCurrent();
  assert.equal(verificationRequested, true);
  assert.equal(hookValue.state.actionAlerts.consent.tone, "success");
  assert.equal(hookValue.state.actionAlerts.consent.message, "Redirecting to secure parent verification…");
  await renderer.unmount();
});

test("useParentConsole privacy export/delete actions refresh summary and request history", async () => {
  let summary = {
    generated_at: "2026-02-19T00:00:00.000Z",
    retention: { transcript_days: 30, raw_audio_stored: false },
    counts: { children: 1, sessions: 1, transcript_messages: 2, parent_only_messages: 0 },
    windows: { first_message_created_at: null, last_message_created_at: null },
    categories: ["child profiles"]
  };
  let requests = [];

  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return {
        parent: {
          id: "parent_1",
          coppa_consent_status: "granted",
          coppa_policy_version: "2026-02-19"
        }
      };
    }
    if (path === "/api/children") {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [] };
    }
    if (path === "/api/privacy/child-data-summary") {
      return { summary };
    }
    if (path === "/api/privacy/requests") {
      return { requests };
    }
    if (path === "/api/privacy/export" && options.method === "POST") {
      const request = {
        id: "request_export_1",
        request_type: "export",
        status: "completed",
        requested_at: "2026-02-19T12:00:00.000Z"
      };
      requests = [request];
      return {
        request,
        export_snapshot: {
          generated_at: "2026-02-19T12:00:00.000Z",
          summary
        }
      };
    }
    if (path === "/api/privacy/delete" && options.method === "POST") {
      const request = {
        id: "request_delete_1",
        request_type: "delete",
        status: "completed",
        requested_at: "2026-02-19T12:10:00.000Z"
      };
      requests = [request, ...requests];
      summary = {
        ...summary,
        counts: { ...summary.counts, children: 0, sessions: 0, transcript_messages: 0, parent_only_messages: 0 }
      };
      return {
        request,
        deletion: {
          deleted_children: 1,
          deleted_sessions: 1,
          deleted_messages: 2,
          requested_at: "2026-02-19T12:10:00.000Z"
        }
      };
    }

    throw new Error(`Unexpected request: ${path}`);
  };

  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  await act(async () => {
    await renderer.getCurrent().actions.requestPrivacyExport({ reason: "records" });
  });

  let hookValue = renderer.getCurrent();
  assert.equal(hookValue.state.actionAlerts.privacyAction.tone, "success");
  assert.equal(hookValue.state.actionAlerts.privacyAction.message, "Export snapshot generated.");
  assert.equal(hookValue.state.privacyRequests[0].request_type, "export");

  await act(async () => {
    await renderer.getCurrent().actions.requestPrivacyDelete({
      reason: "cleanup",
      confirmPhrase: "DELETE CHILD DATA"
    });
  });

  hookValue = renderer.getCurrent();
  assert.equal(hookValue.state.actionAlerts.privacyAction.tone, "success");
  assert.equal(hookValue.state.actionAlerts.privacyAction.message, "Child data deleted.");
  assert.equal(hookValue.state.privacyRequests[0].request_type, "delete");
  assert.equal(hookValue.state.privacySummary.counts.children, 0);
  assert.equal(hookValue.state.selectedChildId, "");

  await renderer.unmount();
});
