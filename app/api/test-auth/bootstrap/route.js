import { ApiError } from "../../../../src/server/api-error.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { getServiceSupabaseClient } from "../../../../src/server/supabase-clients.js";

function isTruthyFlag(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isDuplicateUserError(error) {
  const errorText = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return (
    errorText.includes("already") ||
    errorText.includes("exists") ||
    errorText.includes("registered") ||
    errorText.includes("duplicate")
  );
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

async function readEmailOverrideFromRequest(request) {
  const contentType = String(request.headers.get("content-type") ?? "").trim().toLowerCase();
  if (!contentType.includes("application/json")) {
    return "";
  }

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return "";
    }

    return String(payload.email ?? "").trim();
  } catch {
    return "";
  }
}

function buildBootstrapRedirectUrl(request, env = process.env) {
  const explicitRedirect = String(env.PLAYWRIGHT_TEST_AUTH_REDIRECT_TO ?? "").trim();
  if (explicitRedirect) {
    try {
      return new URL(explicitRedirect).toString();
    } catch {
      throw new ApiError(
        500,
        "test_auth_misconfigured",
        "PLAYWRIGHT_TEST_AUTH_REDIRECT_TO must be a valid absolute URL."
      );
    }
  }

  const redirectPath = String(env.PLAYWRIGHT_TEST_AUTH_REDIRECT_PATH ?? "/auth/callback").trim();
  if (!redirectPath.startsWith("/")) {
    throw new ApiError(
      500,
      "test_auth_misconfigured",
      "PLAYWRIGHT_TEST_AUTH_REDIRECT_PATH must start with '/'."
    );
  }

  return new URL(redirectPath, request.url).toString();
}

export function isTestAuthBootstrapEnabled(env = process.env) {
  if (String(env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    return false;
  }

  return isTruthyFlag(env.ENABLE_TEST_AUTH_BOOTSTRAP);
}

async function ensureBootstrapUserExists(serviceClient, email) {
  const bootstrapPassword = `Pw-${Date.now()}-${Math.random().toString(36).slice(2)}-A1!`;
  const { error } = await serviceClient.auth.admin.createUser({
    email,
    password: bootstrapPassword,
    email_confirm: true,
    user_metadata: {
      role: "playwright-test-parent"
    }
  });

  if (!error || isDuplicateUserError(error)) {
    return;
  }

  throw new ApiError(500, "test_auth_user_create_failed", "Unable to initialize test auth user.");
}

async function createBootstrapLink(serviceClient, { email, redirectTo }) {
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo
    }
  });

  if (error || !data?.properties?.action_link) {
    throw new ApiError(500, "test_auth_link_failed", "Unable to generate test auth bootstrap link.");
  }

  return data.properties.action_link;
}

export function createTestAuthBootstrapPostHandler(dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const getServiceClient = dependencies.getServiceSupabaseClient ?? getServiceSupabaseClient;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      if (!isTestAuthBootstrapEnabled(env)) {
        throw new ApiError(404, "not_found", "Not found.");
      }

      const expectedSecret = String(env.PLAYWRIGHT_TEST_AUTH_SECRET ?? "").trim();
      if (!expectedSecret) {
        throw new ApiError(
          500,
          "test_auth_misconfigured",
          "PLAYWRIGHT_TEST_AUTH_SECRET is required when test auth bootstrap is enabled."
        );
      }

      const providedSecret = String(request.headers.get("x-test-auth-secret") ?? "").trim();
      if (!providedSecret || providedSecret !== expectedSecret) {
        throw new ApiError(401, "invalid_test_auth_secret", "Invalid test auth secret.");
      }

      const overrideEmail = await readEmailOverrideFromRequest(request);
      if (overrideEmail && !isValidEmailAddress(overrideEmail)) {
        throw new ApiError(400, "invalid_test_auth_email", "Email override must be a valid email address.");
      }

      const defaultEmail = String(env.PLAYWRIGHT_TEST_AUTH_EMAIL ?? "").trim();
      const testEmail = overrideEmail || defaultEmail;
      if (!testEmail) {
        throw new ApiError(
          500,
          "test_auth_misconfigured",
          "PLAYWRIGHT_TEST_AUTH_EMAIL is required when test auth bootstrap is enabled."
        );
      }
      if (!isValidEmailAddress(testEmail)) {
        throw new ApiError(
          500,
          "test_auth_misconfigured",
          "PLAYWRIGHT_TEST_AUTH_EMAIL must be a valid email address."
        );
      }

      const redirectTo = buildBootstrapRedirectUrl(request, env);
      const serviceClient = await getServiceClient();
      await ensureBootstrapUserExists(serviceClient, testEmail);
      const actionLink = await createBootstrapLink(serviceClient, {
        email: testEmail,
        redirectTo
      });

      return Response.json({
        auth: {
          email: testEmail,
          action_link: actionLink,
          redirect_to: redirectTo
        }
      });
    } catch (error) {
      return onError(error, "test_auth_bootstrap_failed");
    }
  };
}

export const POST = createTestAuthBootstrapPostHandler();
