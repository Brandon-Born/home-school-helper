import { asApiError } from "./api-error.js";

export function handleRouteError(error, fallbackCode) {
  const apiError = asApiError(error, 500, fallbackCode);

  return Response.json(
    {
      error: apiError.code,
      message: apiError.message
    },
    { status: apiError.status }
  );
}
