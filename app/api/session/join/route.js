import { NextResponse } from "next/server";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { redeemSessionCode } from "../../../../src/server/session-foundation-service.js";

export async function POST(request) {
  try {
    const payload = await request.json();
    const sessionAccess = await redeemSessionCode(payload);

    return NextResponse.json({
      session_access: sessionAccess
    });
  } catch (error) {
    return handleRouteError(error, "session_join_failed");
  }
}
