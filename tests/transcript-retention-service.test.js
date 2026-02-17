import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  computeTranscriptRetentionCutoffIso,
  purgeExpiredTranscripts
} from "../src/server/session-foundation/transcript-retention-service.js";

function createDeleteQuery({ count = 0, error = null } = {}) {
  const recorded = {
    table: null,
    options: null,
    ltField: null,
    ltValue: null,
    selectFields: null
  };

  const query = {
    delete(options = {}) {
      recorded.options = options;
      return query;
    },
    lt(field, value) {
      recorded.ltField = field;
      recorded.ltValue = value;
      return query;
    },
    select(fields) {
      recorded.selectFields = fields;
      return Promise.resolve({
        count,
        error
      });
    }
  };

  const serviceClient = {
    from(table) {
      recorded.table = table;
      return query;
    }
  };

  return { serviceClient, recorded };
}

test("computeTranscriptRetentionCutoffIso returns expected cutoff for 30-day retention", () => {
  const cutoff = computeTranscriptRetentionCutoffIso({
    now: new Date("2026-02-17T00:00:00.000Z"),
    retentionDays: 30
  });

  assert.equal(cutoff, "2026-01-18T00:00:00.000Z");
});

test("purgeExpiredTranscripts deletes messages older than computed cutoff", async () => {
  const { serviceClient, recorded } = createDeleteQuery({ count: 7 });

  const result = await purgeExpiredTranscripts(
    {
      retentionDays: 30,
      now: new Date("2026-02-17T00:00:00.000Z")
    },
    { serviceClient }
  );

  assert.equal(recorded.table, "messages");
  assert.deepEqual(recorded.options, { count: "exact" });
  assert.equal(recorded.ltField, "created_at");
  assert.equal(recorded.ltValue, "2026-01-18T00:00:00.000Z");
  assert.equal(recorded.selectFields, "id");
  assert.deepEqual(result, {
    deleted_count: 7,
    retention_days: 30,
    cutoff_iso: "2026-01-18T00:00:00.000Z"
  });
});

test("computeTranscriptRetentionCutoffIso rejects invalid retention days", () => {
  assert.throws(
    () =>
      computeTranscriptRetentionCutoffIso({
        now: new Date(),
        retentionDays: 0
      }),
    (error) => error instanceof ApiError && error.code === "validation_error"
  );
});
