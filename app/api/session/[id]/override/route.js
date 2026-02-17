import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { setSessionDirectAnswerOverride } from "../../../../../src/server/session-foundation-service.js";

export async function POST(request, { params }) {
  try {
    const payload = await request.json();
    const { parent } = await requireParentContext(request);

    const result = await setSessionDirectAnswerOverride({
      sessionId: params.id,
      parentId: parent.id,
      enabled: Boolean(payload.enabled),
      durationMinutes: payload.duration_minutes
    });

    return NextResponse.json({ override: result });
  } catch (error) {
    return handleRouteError(error, "override_update_failed");
  }
}
