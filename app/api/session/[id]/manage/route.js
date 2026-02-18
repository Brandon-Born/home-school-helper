import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../../src/server/auth.js";
import {
    endSessionForParent,
    regenerateJoinCodeForSession
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";

export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const payload = await request.json();
        const { parent } = await requireParentContext(request);

        if (payload.action === "end") {
            const result = await endSessionForParent(parent.id, id);
            return NextResponse.json({ session: result });
        }

        if (payload.action === "regenerate_code") {
            const result = await regenerateJoinCodeForSession(parent.id, id);
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { error: "invalid_action", message: "Action must be 'end' or 'regenerate_code'." },
            { status: 400 }
        );
    } catch (error) {
        return handleRouteError(error, "session_manage_failed");
    }
}
