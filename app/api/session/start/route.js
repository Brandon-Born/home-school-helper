import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { startSessionForParent } from "../../../../src/server/session-foundation-service.js";

export async function POST(request) {
  try {
    const payload = await request.json();
    const { parent } = await requireParentContext(request);
    const session = await startSessionForParent(parent.id, payload);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "session_start_failed");
  }
}
