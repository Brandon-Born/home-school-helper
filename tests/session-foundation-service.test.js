import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/server/api-error.js";
import {
  normalizeChildProfilePayload,
  normalizeSessionJoinPayload,
  normalizeSessionStartPayload
} from "../src/server/session-foundation-service.js";

test("normalizeChildProfilePayload accepts valid onboarding payload", () => {
  const payload = normalizeChildProfilePayload({
    child_name: "Ava",
    age: 10,
    grade: "5",
    subjects: ["Math", "Science"],
    personality_description: "Curious and energetic",
    special_needs: "Needs short instructions"
  });

  assert.equal(payload.first_name, "Ava");
  assert.equal(payload.age, 10);
  assert.deepEqual(payload.subjects, ["Math", "Science"]);
});

test("normalizeChildProfilePayload rejects invalid age", () => {
  assert.throws(
    () =>
      normalizeChildProfilePayload({
        child_name: "Ava",
        age: 2,
        grade: "K",
        subjects: ["Math"]
      }),
    (error) => error instanceof ApiError && error.code === "validation_error"
  );
});

test("normalizeSessionStartPayload requires daily subjects", () => {
  assert.throws(
    () => normalizeSessionStartPayload({ child_id: "child_1", daily_subjects: [] }),
    (error) => error instanceof ApiError && error.code === "validation_error"
  );
});

test("normalizeSessionJoinPayload normalizes code", () => {
  const payload = normalizeSessionJoinPayload({ code: "ab12- cd34", device_fingerprint: "device-1" });
  assert.equal(payload.code, "AB12CD34");
  assert.equal(payload.device_fingerprint, "device-1");
});
