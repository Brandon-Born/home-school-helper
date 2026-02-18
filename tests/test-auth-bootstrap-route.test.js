import test from "node:test";
import assert from "node:assert/strict";

import { createTestAuthBootstrapPostHandler } from "../app/api/test-auth/bootstrap/route.js";
import { assertApiErrorResponse } from "./helpers/route-test-helpers.js";

function createBootstrapRequest(headers = {}) {
  return new Request("http://localhost:3000/api/test-auth/bootstrap", {
    method: "POST",
    headers
  });
}

test("test auth bootstrap route returns not_found when disabled", async () => {
  const handler = createTestAuthBootstrapPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "0"
    }
  });

  const response = await handler(createBootstrapRequest());
  await assertApiErrorResponse(response, {
    status: 404,
    error: "not_found",
    message: "Not found."
  });
});

test("test auth bootstrap route requires matching secret header", async () => {
  const handler = createTestAuthBootstrapPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "1",
      PLAYWRIGHT_TEST_AUTH_SECRET: "top-secret",
      PLAYWRIGHT_TEST_AUTH_EMAIL: "playwright-parent@example.test"
    }
  });

  const response = await handler(createBootstrapRequest());
  await assertApiErrorResponse(response, {
    status: 401,
    error: "invalid_test_auth_secret",
    message: "Invalid test auth secret."
  });
});

test("test auth bootstrap route creates link for configured test account", async () => {
  let createUserArgs = null;
  let generateLinkArgs = null;

  const handler = createTestAuthBootstrapPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "1",
      PLAYWRIGHT_TEST_AUTH_SECRET: "top-secret",
      PLAYWRIGHT_TEST_AUTH_EMAIL: "playwright-parent@example.test",
      PLAYWRIGHT_TEST_AUTH_REDIRECT_PATH: "/auth/callback"
    },
    getServiceSupabaseClient: () => ({
      auth: {
        admin: {
          createUser: async (args) => {
            createUserArgs = args;
            return {
              data: {
                user: {
                  id: "user_1"
                }
              },
              error: null
            };
          },
          generateLink: async (args) => {
            generateLinkArgs = args;
            return {
              data: {
                properties: {
                  action_link: "https://example.supabase.co/auth/v1/verify?token=abc",
                  redirect_to: "http://localhost:3000/auth/callback",
                  email_otp: "123456",
                  hashed_token: "hashed",
                  verification_type: "magiclink"
                },
                user: {
                  id: "user_1"
                }
              },
              error: null
            };
          }
        }
      }
    })
  });

  const response = await handler(
    createBootstrapRequest({
      "x-test-auth-secret": "top-secret"
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    auth: {
      email: "playwright-parent@example.test",
      action_link: "https://example.supabase.co/auth/v1/verify?token=abc",
      redirect_to: "http://localhost:3000/auth/callback"
    }
  });

  assert.equal(createUserArgs.email, "playwright-parent@example.test");
  assert.equal(createUserArgs.email_confirm, true);
  assert.equal(typeof createUserArgs.password, "string");
  assert.equal(generateLinkArgs.type, "magiclink");
  assert.equal(generateLinkArgs.email, "playwright-parent@example.test");
  assert.equal(generateLinkArgs.options.redirectTo, "http://localhost:3000/auth/callback");
});

test("test auth bootstrap route tolerates already-registered user errors", async () => {
  let generated = false;

  const handler = createTestAuthBootstrapPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "1",
      PLAYWRIGHT_TEST_AUTH_SECRET: "top-secret",
      PLAYWRIGHT_TEST_AUTH_EMAIL: "playwright-parent@example.test"
    },
    getServiceSupabaseClient: () => ({
      auth: {
        admin: {
          createUser: async () => ({
            data: { user: null },
            error: {
              message: "User already registered"
            }
          }),
          generateLink: async () => {
            generated = true;
            return {
              data: {
                properties: {
                  action_link: "https://example.supabase.co/auth/v1/verify?token=xyz"
                },
                user: {
                  id: "user_1"
                }
              },
              error: null
            };
          }
        }
      }
    })
  });

  const response = await handler(
    createBootstrapRequest({
      "x-test-auth-secret": "top-secret"
    })
  );

  assert.equal(response.status, 200);
  assert.equal(generated, true);
});
