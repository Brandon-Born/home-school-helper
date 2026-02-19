import test from "node:test";
import assert from "node:assert/strict";

import { requireChildSessionContext, requireParentContext } from "../src/server/auth.js";
import {
  createChildForParent,
  getSessionTutorContext,
  listChildrenForParent,
  listSessionMessages,
  persistSessionMessage,
  persistTutorAuditEvents,
  redeemSessionCode,
  setParentCoppaConsentState,
  startSessionForParent
} from "../src/server/session-foundation-service.js";
import { runSessionTutorTurn } from "../src/server/session-turn-orchestrator.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";

test("critical path covers parent onboarding through child tutoring turn", async () => {
  const serviceClient = createFakeServiceClient();
  const anonClient = {
    auth: {
      getUser: async () => ({
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
      })
    }
  };

  const parentRequest = new Request("https://example.test/api/parent/me", {
    headers: {
      authorization: "Bearer parent-token"
    }
  });

  const parentContext = await requireParentContext(parentRequest, {
    anonClient,
    serviceClient
  });

  await setParentCoppaConsentState(parentContext.parent.id, { status: "granted" }, { serviceClient });

  const child = await createChildForParent(
    parentContext.parent.id,
    {
      child_name: "Ava",
      age: 9,
      grade: "4",
      subjects: ["Math", "Science"],
      personality_description: "Learns best with encouragement."
    },
    { serviceClient }
  );

  const parentChildren = await listChildrenForParent(parentContext.parent.id, { serviceClient });
  assert.equal(parentChildren.length, 1);
  assert.equal(parentChildren[0].id, child.id);

  const startedSession = await startSessionForParent(
    parentContext.parent.id,
    {
      child_id: child.id,
      daily_subjects: ["Math"],
      parent_context: "Keep confidence high and avoid giving direct final answers.",
      goal_notes: "Focus on fractions."
    },
    { serviceClient }
  );

  const joinAccess = await redeemSessionCode(
    {
      code: startedSession.join_code,
      device_fingerprint: "child-ipad"
    },
    { serviceClient }
  );

  const childRequest = new Request(
    `https://example.test/api/session/${startedSession.session_id}/child-turn`,
    {
      headers: {
        authorization: `Bearer ${joinAccess.child_session_token}`
      }
    }
  );

  const childContext = await requireChildSessionContext(childRequest, startedSession.session_id, {
    serviceClient
  });
  assert.equal(childContext.tokenRow.child_id, child.id);

  const tutorContext = await getSessionTutorContext(
    {
      sessionId: startedSession.session_id,
      childId: childContext.tokenRow.child_id
    },
    { serviceClient }
  );

  const tutorResult = await runSessionTutorTurn(
    {
      sessionId: startedSession.session_id,
      source: "child-turn",
      studentInput: "Can you help me simplify 3/6?",
      parentGuidance: tutorContext.latestParentGuidance,
      profile: tutorContext.profile,
      dailyContext: tutorContext.dailyContext,
      allowDirectAnswer: tutorContext.allowDirectAnswer,
      inputActorType: "child",
      inputVisibilityScope: "child_and_parent"
    },
    {
      generateTutorTurn: async () => ({
        assistant_text: "Great start. What is the greatest common factor of 3 and 6?",
        policy_applied: ["scaffold_first"],
        model_used: "test-model-v1"
      }),
      persistSessionMessage: (payload) => persistSessionMessage(payload, { serviceClient }),
      persistTutorAuditEvents: (payload) => persistTutorAuditEvents(payload, { serviceClient }),
      getTutorConfig: () => ({
        promptVersion: "test-prompt-v1"
      })
    }
  );

  assert.equal(tutorResult.assistant_text.includes("greatest common factor"), true);

  const childVisibleMessages = await listSessionMessages(
    {
      sessionId: startedSession.session_id,
      visibility: "child",
      limit: 20
    },
    { serviceClient }
  );
  assert.deepEqual(
    childVisibleMessages.map((message) => message.actor_type),
    ["child", "assistant"]
  );
  assert.equal(childVisibleMessages[1].content.includes("greatest common factor"), true);

  assert.equal(serviceClient.tables.policy_events.length, 2);
  assert.deepEqual(
    serviceClient.tables.policy_events.map((event) => event.event_type),
    ["tutor_model_call", "guardrail_policy"]
  );
});
