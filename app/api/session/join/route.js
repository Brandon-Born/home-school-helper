import { NextResponse } from "next/server";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { redeemSessionCode } from "../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";

export async function POST(request) {
  try {
    enforceRateLimit(request, {
      scope: "session_join",
      maxRequests: 10,
      windowMs: 60_000
    });

    const payload = await request.json();
    const sessionAccess = await redeemSessionCode(payload);

    return NextResponse.json({
      session_access: sessionAccess
    });
  } catch (error) {
    return handleRouteError(error, "session_join_failed");
  }
}
