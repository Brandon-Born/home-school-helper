import { ApiError } from "./api-error.js";

export function requireCronAuthorization(request, env = process.env) {
  const expectedSecret = String(env.CRON_SECRET || "").trim();
  if (!expectedSecret) {
    throw new ApiError(500, "cron_secret_missing", "CRON_SECRET is not configured.");
  }

  const authorization = String(request.headers.get("authorization") || "").trim();
  if (authorization === `Bearer ${expectedSecret}`) {
    return;
  }

  const headerSecret = String(request.headers.get("x-cron-secret") || "").trim();
  if (headerSecret && headerSecret === expectedSecret) {
    return;
  }

  throw new ApiError(401, "invalid_cron_secret", "Invalid cron authorization.");
}

