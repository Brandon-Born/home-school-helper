import test from "node:test";
import assert from "node:assert/strict";

import { getChildDataSummaryForParent } from "../src/server/session-foundation/privacy-service.js";
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
