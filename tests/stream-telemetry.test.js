import test from "node:test";
import assert from "node:assert/strict";

import { getStreamErrorDetails } from "../src/lib/stream-telemetry.js";
import { getServerStreamErrorDetails } from "../src/server/stream-telemetry.js";

test("getStreamErrorDetails extracts structured client stream error fields", () => {
  const details = getStreamErrorDetails({
    name: "EventStreamError",
    code: "invalid_parent_token",
    status: 401
  });

  assert.deepEqual(details, {
    error_name: "EventStreamError",
    error_code: "invalid_parent_token",
    error_status: 401
  });
});

test("getServerStreamErrorDetails extracts structured server stream error fields", () => {
  const details = getServerStreamErrorDetails({
    code: "stream_failed",
    status: 500,
    message: "boom"
  });

  assert.deepEqual(details, {
    error_code: "stream_failed",
    error_status: 500
  });
});

test("getServerStreamErrorDetails can include error message only when explicitly enabled", () => {
  const details = getServerStreamErrorDetails(
    {
      code: "stream_failed",
      status: 500,
      message: "boom"
    },
    {
      env: {
        SERVER_TELEMETRY_INCLUDE_ERROR_MESSAGE: "1"
      }
    }
  );

  assert.deepEqual(details, {
    error_code: "stream_failed",
    error_status: 500,
    error_message: "boom"
  });
});
