import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../src/server/auth.js";
import { listActiveSessionsForParent } from "../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";

export async function GET(request) {
    try {
        const { parent } = await requireParentContext(request);
        const sessions = await listActiveSessionsForParent(parent.id);
        return NextResponse.json({ sessions });
    } catch (error) {
        return handleRouteError(error, "active_sessions_fetch_failed");
    }
}
