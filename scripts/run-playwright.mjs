import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function normalizeValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    if (process.env[key] && String(process.env[key]).trim()) {
      continue;
    }

    process.env[key] = normalizeValue(trimmed.slice(separator + 1));
  }
}

function loadDotEnvFiles() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
}

function runPlaywright(args = [], envOverrides = {}) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(command, ["playwright", "test", ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides
    }
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function runDefaultAndTransportMatrix() {
  const defaultCode = await runPlaywright(["--grep-invert", "@transport-mode"]);
  if (defaultCode !== 0) {
    return defaultCode;
  }

  const transportSpec = "tests/playwright/transport-mode-stream.spec.js";
  const realtimeCode = await runPlaywright([transportSpec], {
    STREAM_TRANSPORT_MODE: "realtime",
    PLAYWRIGHT_EXPECTED_TRANSPORT_MODE: "realtime"
  });
  if (realtimeCode !== 0) {
    return realtimeCode;
  }

  const pollingCode = await runPlaywright([transportSpec], {
    STREAM_TRANSPORT_MODE: "polling",
    PLAYWRIGHT_EXPECTED_TRANSPORT_MODE: "polling"
  });
  return pollingCode;
}

loadDotEnvFiles();
const args = process.argv.slice(2);

if (args.length > 0) {
  const code = await runPlaywright(args);
  process.exit(code);
} else {
  const code = await runDefaultAndTransportMatrix();
  process.exit(code);
}
