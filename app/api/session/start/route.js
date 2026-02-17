import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { startSessionForParent } from "../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../src/server/rate-limit.js";

export async function POST(request) {
  try {
    enforceRateLimit(request, {
      scope: "session_start",
      maxRequests: 20,
      windowMs: 60_000
    });

    const payload = await request.json();
    const { parent } = await requireParentContext(request);
    const session = await startSessionForParent(parent.id, payload);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "session_start_failed");
  }
}
