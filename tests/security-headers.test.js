import test from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config.mjs";

function toHeaderMap(headers) {
  return new Map(headers.map((header) => [header.key, header.value]));
}

test("next security headers include CSP and baseline hardening headers", async () => {
  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === "/:path*");
  assert.ok(globalRule);

  const headerMap = toHeaderMap(globalRule.headers);
  const csp = headerMap.get("Content-Security-Policy");
  assert.ok(csp);
  assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(csp, /frame-ancestors 'none'/);

  assert.equal(headerMap.get("X-Frame-Options"), "DENY");
  assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
});

test("next security headers enable HSTS in production mode", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const rules = await nextConfig.headers();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    const headerMap = toHeaderMap(globalRule.headers);
    const csp = headerMap.get("Content-Security-Policy");
    assert.equal(
      headerMap.get("Strict-Transport-Security"),
      "max-age=31536000; includeSubDomains; preload"
    );
    assert.match(csp, /script-src 'self' 'unsafe-inline'/);
    assert.equal(csp.includes("'unsafe-eval'"), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});
