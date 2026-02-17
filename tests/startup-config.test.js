import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.resolve("scripts/validate-env.mjs");

test("startup validation fails when required env vars are missing", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      DISABLE_DOTENV_LOAD: "1",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_MODEL: ""
    },
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required environment variables/);
});

test("startup validation succeeds when required env vars are present", () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      DISABLE_DOTENV_LOAD: "1",
      ANTHROPIC_API_KEY: "test_key",
      ANTHROPIC_MODEL: "claude-test"
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Tutor environment valid/);
});
