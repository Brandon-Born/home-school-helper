import test from "node:test";
import assert from "node:assert/strict";

import { EventStreamError } from "../src/lib/event-stream.js";
import { ApiRequestError } from "../src/lib/http.js";
import {
  isChildAuthFailure,
  isParentAuthFailure
} from "../src/lib/auth-failures.js";

test("isChildAuthFailure detects structured child-token auth failures", () => {
  assert.equal(
    isChildAuthFailure(new ApiRequestError("nope", { status: 401, code: "invalid_child_session_token" })),
    true
  );
  assert.equal(
    isChildAuthFailure(new EventStreamError("forbidden", { status: 403, code: "missing_authorization" })),
    true
  );
});

test("isChildAuthFailure ignores unrelated failures", () => {
  assert.equal(isChildAuthFailure(new Error("network timeout")), false);
  assert.equal(isChildAuthFailure(new ApiRequestError("oops", { status: 500, code: "internal_error" })), false);
});

test("isParentAuthFailure detects structured parent-token auth failures", () => {
  assert.equal(
    isParentAuthFailure(new ApiRequestError("bad", { status: 401, code: "invalid_parent_token" })),
    true
  );
  assert.equal(
    isParentAuthFailure(new EventStreamError("missing", { status: 403, code: "missing_authorization" })),
    true
  );
});

test("isParentAuthFailure ignores unrelated failures", () => {
  assert.equal(isParentAuthFailure(new Error("network timeout")), false);
  assert.equal(isParentAuthFailure(new ApiRequestError("oops", { status: 500, code: "internal_error" })), false);
});
