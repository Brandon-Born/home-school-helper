import { ApiError, asApiError } from "./api-error.js";

export const GENERIC_SERVER_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function toPublicApiError(error, fallbackCode) {
  if (error instanceof ApiError) {
    return error;
  }

  const apiError = asApiError(error, 500, fallbackCode);
  if (apiError.status >= 500) {
    return new ApiError(apiError.status, apiError.code, GENERIC_SERVER_ERROR_MESSAGE);
  }

  return apiError;
}

export function handleRouteError(error, fallbackCode) {
  console.error("[route_error]", {
    fallbackCode,
    name: error?.name ?? null,
    status: error?.status ?? null,
    code: error?.code ?? null,
    message: error?.message ?? null,
    stack: error?.stack ?? null
  });

  const apiError = toPublicApiError(error, fallbackCode);

  return Response.json(
    {
      error: apiError.code,
      message: apiError.message
    },
    { status: apiError.status }
  );
}
