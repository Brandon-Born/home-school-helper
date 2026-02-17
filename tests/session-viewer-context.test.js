import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { resolveSessionViewerContext } from "../src/server/session-viewer-context.js";

test("resolveSessionViewerContext resolves parent viewer when parent token and ownership are valid", async () => {
  const context = await resolveSessionViewerContext(new Request("https://example.test"), "session_1", {
    requireParentContext: async () => ({ parent: { id: "parent_1" } }),
    ensureParentOwnsSession: async () => ({ id: "session_1" }),
    requireChildSessionContext: async () => {
      throw new Error("child path should not run");
    }
  });

  assert.deepEqual(context, {
    role: "parent",
    visibility: "all",
    parent_id: "parent_1"
  });
});

test("resolveSessionViewerContext falls back to child viewer only on 401 parent auth errors", async () => {
  const context = await resolveSessionViewerContext(new Request("https://example.test"), "session_2", {
    requireParentContext: async () => {
      throw new ApiError(401, "invalid_parent_token", "invalid");
    },
    ensureParentOwnsSession: async () => {
      throw new Error("ownership path should not run after auth failure");
    },
    requireChildSessionContext: async (_request, sessionId) => ({
      tokenRow: { child_id: "child_1", session_id: sessionId }
    })
  });

  assert.deepEqual(context, {
    role: "child",
    visibility: "child",
    child_id: "child_1"
  });
});

test("resolveSessionViewerContext surfaces non-401 parent errors", async () => {
  await assert.rejects(
    () =>
      resolveSessionViewerContext(new Request("https://example.test"), "session_3", {
        requireParentContext: async () => ({ parent: { id: "parent_1" } }),
        ensureParentOwnsSession: async () => {
          throw new ApiError(404, "session_not_found", "not found");
        },
        requireChildSessionContext: async () => ({ tokenRow: { child_id: "child_1" } })
      }),
    (error) => error instanceof ApiError && error.status === 404 && error.code === "session_not_found"
  );
});
