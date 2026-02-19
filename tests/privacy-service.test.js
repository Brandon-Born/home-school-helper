import test from "node:test";
import assert from "node:assert/strict";

import {
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  createPrivacyRequestForParent,
  deleteChildDataForParent,
  generateExportSnapshotForParent,
  getChildDataSummaryForParent,
  listPrivacyRequestsForParent,
  markPrivacyRequestCompleted,
  markPrivacyRequestFailed
} from "../src/server/session-foundation/privacy-service.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";

test("getChildDataSummaryForParent returns aggregate category counts without transcript content", async () => {
  const serviceClient = createFakeServiceClient({
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava",
        profile_notes: "Learns better with short steps",
        special_needs: "",
        created_at: "2026-02-18T10:00:00.000Z"
      }
    ],
    sessions: [
      {
        id: "session_1",
        parent_id: "parent_1",
        child_id: "child_1",
        status: "active",
        started_at: "2026-02-18T11:00:00.000Z"
      },
      {
        id: "session_2",
        parent_id: "parent_1",
        child_id: "child_1",
        status: "ended",
        started_at: "2026-02-18T12:00:00.000Z",
        ended_at: "2026-02-18T12:30:00.000Z"
      }
    ],
    messages: [
      {
        id: "m1",
        session_id: "session_1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "private content should not be in summary",
        created_at: "2026-02-18T11:01:00.000Z"
      },
      {
        id: "m2",
        session_id: "session_1",
        actor_type: "parent",
        visibility_scope: "parent_only",
        content: "also should not be in summary",
        created_at: "2026-02-18T11:02:00.000Z"
      }
    ]
  });

  const summary = await getChildDataSummaryForParent("parent_1", { serviceClient });

  assert.equal(summary.counts.children, 1);
  assert.equal(summary.counts.sessions, 2);
  assert.equal(summary.counts.active_sessions, 1);
  assert.equal(summary.counts.ended_sessions, 1);
  assert.equal(summary.counts.transcript_messages, 2);
  assert.equal(summary.counts.parent_only_messages, 1);
  assert.equal(summary.retention.raw_audio_stored, false);
  assert.equal(summary.children[0].has_profile_notes, true);
  assert.equal(summary.children[0].has_special_needs, false);
  assert.ok(!JSON.stringify(summary).includes("private content should not be in summary"));
});

test("getChildDataSummaryForParent returns zeroed message counts when no sessions exist", async () => {
  const serviceClient = createFakeServiceClient({
    children: [],
    sessions: [],
    messages: []
  });

  const summary = await getChildDataSummaryForParent("parent_1", { serviceClient });
  assert.equal(summary.counts.sessions, 0);
  assert.equal(summary.counts.transcript_messages, 0);
  assert.equal(summary.windows.first_message_created_at, null);
  assert.equal(summary.windows.last_message_created_at, null);
});

test("listPrivacyRequestsForParent returns parent-scoped requests sorted by requested_at desc", async () => {
  const serviceClient = createFakeServiceClient({
    privacy_requests: [
      {
        id: "r_old",
        parent_id: "parent_1",
        request_type: "export",
        status: "completed",
        requested_at: "2026-02-19T10:00:00.000Z"
      },
      {
        id: "r_other_parent",
        parent_id: "parent_2",
        request_type: "delete",
        status: "failed",
        requested_at: "2026-02-19T11:00:00.000Z"
      },
      {
        id: "r_new",
        parent_id: "parent_1",
        request_type: "delete",
        status: "processing",
        requested_at: "2026-02-19T12:00:00.000Z"
      }
    ]
  });

  const requests = await listPrivacyRequestsForParent("parent_1", { serviceClient, limit: 2 });
  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((request) => request.id),
    ["r_new", "r_old"]
  );
});

test("createPrivacyRequestForParent and markPrivacyRequestCompleted persist lifecycle state", async () => {
  const serviceClient = createFakeServiceClient();

  const created = await createPrivacyRequestForParent(
    "parent_1",
    {
      request_type: PRIVACY_REQUEST_TYPES.export,
      reason: "Need records",
      actor_parent_id: "parent_1"
    },
    { serviceClient }
  );

  assert.equal(created.request_type, PRIVACY_REQUEST_TYPES.export);
  assert.equal(created.status, PRIVACY_REQUEST_STATUSES.processing);
  assert.equal(created.reason, "Need records");

  const completed = await markPrivacyRequestCompleted(
    created.id,
    { counts: { children: 1 }, generated_at: "2026-02-19T20:00:00.000Z" },
    { serviceClient }
  );

  assert.equal(completed.status, PRIVACY_REQUEST_STATUSES.completed);
  assert.equal(completed.result_json.counts.children, 1);
  assert.ok(typeof completed.completed_at === "string");
});

test("markPrivacyRequestFailed stores failure status and message", async () => {
  const serviceClient = createFakeServiceClient({
    privacy_requests: [
      {
        id: "r1",
        parent_id: "parent_1",
        request_type: PRIVACY_REQUEST_TYPES.delete,
        status: PRIVACY_REQUEST_STATUSES.processing,
        requested_at: "2026-02-19T21:00:00.000Z"
      }
    ]
  });

  const failed = await markPrivacyRequestFailed("r1", "Delete failed for test", { serviceClient });
  assert.equal(failed.status, PRIVACY_REQUEST_STATUSES.failed);
  assert.equal(failed.error_message, "Delete failed for test");
  assert.ok(typeof failed.completed_at === "string");
});

test("generateExportSnapshotForParent returns summary plus detailed child/session/message rows", async () => {
  const serviceClient = createFakeServiceClient({
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava",
        age: 9,
        grade: "4",
        subjects: ["Math"],
        profile_notes: "",
        special_needs: "",
        created_at: "2026-02-19T08:00:00.000Z"
      }
    ],
    sessions: [
      {
        id: "session_1",
        parent_id: "parent_1",
        child_id: "child_1",
        status: "ended",
        daily_context: { daily_subjects: ["Math"] },
        started_at: "2026-02-19T09:00:00.000Z",
        ended_at: "2026-02-19T09:20:00.000Z"
      }
    ],
    messages: [
      {
        id: "m1",
        session_id: "session_1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "What is 12 / 3?",
        policy_flags: [],
        created_at: "2026-02-19T09:01:00.000Z"
      }
    ]
  });

  const snapshot = await generateExportSnapshotForParent("parent_1", { serviceClient });
  assert.equal(snapshot.parent_id, "parent_1");
  assert.equal(snapshot.summary.counts.children, 1);
  assert.equal(snapshot.data.children.length, 1);
  assert.equal(snapshot.data.sessions.length, 1);
  assert.equal(snapshot.data.messages.length, 1);
  assert.equal(snapshot.data.messages[0].content, "What is 12 / 3?");
});

test("deleteChildDataForParent reports deletion counts and removes parent child rows", async () => {
  const serviceClient = createFakeServiceClient({
    children: [
      {
        id: "child_1",
        parent_id: "parent_1",
        first_name: "Ava",
        age: 9,
        grade: "4",
        subjects: ["Math"],
        created_at: "2026-02-19T08:00:00.000Z"
      }
    ],
    sessions: [
      {
        id: "session_1",
        parent_id: "parent_1",
        child_id: "child_1",
        status: "ended",
        started_at: "2026-02-19T09:00:00.000Z",
        ended_at: "2026-02-19T09:20:00.000Z"
      }
    ],
    messages: [
      {
        id: "m1",
        session_id: "session_1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "hello",
        created_at: "2026-02-19T09:01:00.000Z"
      }
    ]
  });

  const result = await deleteChildDataForParent("parent_1", { serviceClient });
  assert.equal(result.deleted_children, 1);
  assert.equal(result.deleted_sessions, 1);
  assert.equal(result.deleted_messages, 1);
  assert.equal(serviceClient.tables.children.length, 0);
});
