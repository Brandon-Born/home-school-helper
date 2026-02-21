import test from "node:test";
import assert from "node:assert/strict";
import { parseThemeMode } from "../src/lib/theme-mode.js";

test("parseThemeMode returns null for invalid values", () => {
  assert.equal(parseThemeMode(undefined), null);
  assert.equal(parseThemeMode(""), null);
  assert.equal(parseThemeMode("sepia"), null);
  assert.equal(parseThemeMode("system"), null);
});

test("parseThemeMode keeps supported values", () => {
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("dark"), "dark");
});
