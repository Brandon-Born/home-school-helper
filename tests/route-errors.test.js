import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  GENERIC_SERVER_ERROR_MESSAGE,
  handleRouteError
} from "../src/server/route-errors.js";

test("handleRouteError keeps explicit ApiError payloads", async () => {
  const response = handleRouteError(
    new ApiError(403, "session_forbidden", "Forbidden"),
    "session_failed"
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "session_forbidden",
    message: "Forbidden"
  });
});

test("handleRouteError redacts unexpected server exceptions", async () => {
  const response = handleRouteError(new Error("db timeout with secret details"), "session_failed");

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "session_failed",
    message: GENERIC_SERVER_ERROR_MESSAGE
  });
});
