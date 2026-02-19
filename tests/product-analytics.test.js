import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { normalizeProductAnalyticsEvent } from "../src/server/product-analytics.js";

test("normalizeProductAnalyticsEvent accepts session_start payload and clamps counts", () => {
  const result = normalizeProductAnalyticsEvent({
    event: "session_start",
    payload: {
      status: "success",
      subject_count: 9999,
      has_parent_context: true
    }
  });

  assert.deepEqual(result, {
    event: "session_start",
    payload: {
      status: "success",
      subject_count: 20,
      has_parent_context: true
    }
  });
});

test("normalizeProductAnalyticsEvent accepts voice_usage transport", () => {
  const result = normalizeProductAnalyticsEvent({
    event: "voice_usage",
    payload: {
      status: "transcribed",
      transport: "cloud_stt"
    }
  });

  assert.deepEqual(result, {
    event: "voice_usage",
    payload: {
      status: "transcribed",
      transport: "cloud_stt"
    }
  });
});

test("normalizeProductAnalyticsEvent rejects unsupported event names", () => {
  assert.throws(
    () => {
      normalizeProductAnalyticsEvent({
        event: "unknown_event",
        payload: {
          status: "success"
        }
      });
    },
    (error) => error instanceof ApiError && error.code === "validation_error"
  );
});

test("normalizeProductAnalyticsEvent rejects missing event status", () => {
  assert.throws(
    () => {
      normalizeProductAnalyticsEvent({
        event: "turn_send",
        payload: {}
      });
    },
    (error) => error instanceof ApiError && error.code === "validation_error"
  );
});
