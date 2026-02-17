import test from "node:test";
import assert from "node:assert/strict";
import {
  createChildSessionToken,
  generateJoinCode,
  hashOpaqueToken,
  normalizeJoinCode
} from "../src/server/session-codes.js";

test("generateJoinCode returns uppercase alphanumeric code", () => {
  const code = generateJoinCode(8);
  assert.equal(code.length, 8);
  assert.match(code, /^[A-Z2-9]+$/);
});

test("normalizeJoinCode strips separators and uppercases", () => {
  assert.equal(normalizeJoinCode(" ab-12 cd "), "AB12CD");
});

test("hashOpaqueToken is deterministic", () => {
  const first = hashOpaqueToken("sample-token");
  const second = hashOpaqueToken("sample-token");

  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("createChildSessionToken creates non-empty random token", () => {
  const first = createChildSessionToken();
  const second = createChildSessionToken();

  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
});
