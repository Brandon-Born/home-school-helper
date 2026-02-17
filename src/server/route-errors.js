import { NextResponse } from "next/server";
import { asApiError } from "./api-error.js";

export function handleRouteError(error, fallbackCode) {
  const apiError = asApiError(error, 500, fallbackCode);

  return NextResponse.json(
    {
      error: apiError.code,
      message: apiError.message
    },
    { status: apiError.status }
  );
}
