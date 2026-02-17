export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function asApiError(error, fallbackStatus = 500, fallbackCode = "internal_error") {
  if (error instanceof ApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return new ApiError(fallbackStatus, fallbackCode, message);
}
