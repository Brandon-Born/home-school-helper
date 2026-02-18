import { ApiError } from "./api-error.js";

export async function readSessionIdParam(params) {
  const resolved = await params;
  const sessionId = typeof resolved?.id === "string" ? resolved.id.trim() : "";

  if (!sessionId) {
    throw new ApiError(400, "invalid_session_id", "Session id is required.");
  }

  return sessionId;
}

export async function runSessionRoute({
  request,
  params,
  run,
  onError,
  fallbackCode,
  onRouteError,
  readSessionId = readSessionIdParam
}) {
  let sessionId = "unknown";

  try {
    sessionId = await readSessionId(params);
    return await run({ request, sessionId });
  } catch (error) {
    const context = { request, sessionId };
    if (typeof onRouteError === "function") {
      try {
        await onRouteError({ error, ...context });
      } catch {
        // Do not hide original route failures when telemetry/logging callbacks fail.
      }
    }

    return onError(error, fallbackCode, context);
  }
}
