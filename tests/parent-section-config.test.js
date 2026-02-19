import assert from "node:assert/strict";
import test from "node:test";

import {
  PARENT_CONSOLE_SECTIONS,
  resolveParentConsoleSection
} from "../app/parent/section-config.js";

test("parent console sections keep expected order for nav rendering", () => {
  assert.deepEqual(
    PARENT_CONSOLE_SECTIONS.map((section) => section.id),
    ["children", "sessions", "managed"]
  );
});

test("resolveParentConsoleSection falls back to children section", () => {
  const resolved = resolveParentConsoleSection("unknown");
  assert.equal(resolved.id, "children");
});

test("resolveParentConsoleSection returns matching section", () => {
  const resolved = resolveParentConsoleSection("managed");
  assert.equal(resolved.label, "Privacy & Data");
});
