import test from "node:test";
import assert from "node:assert/strict";
import { parseThemeMode, resolveTheme } from "../src/lib/theme-mode.js";

test("parseThemeMode returns system for invalid values", () => {
  assert.equal(parseThemeMode(undefined), "system");
  assert.equal(parseThemeMode(""), "system");
  assert.equal(parseThemeMode("sepia"), "system");
});

test("parseThemeMode keeps supported values", () => {
  assert.equal(parseThemeMode("system"), "system");
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("dark"), "dark");
});

test("resolveTheme keeps explicit light/dark values", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("resolveTheme follows system preference", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});
