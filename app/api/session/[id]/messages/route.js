import { NextResponse } from "next/server";
import {
  requireChildSessionContext,
  requireParentContext
} from "../../../../../src/server/auth.js";
import { ApiError } from "../../../../../src/server/api-error.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import {
  ensureParentOwnsSession,
  listSessionMessages
} from "../../../../../src/server/session-foundation-service.js";

export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);

    try {
      const { parent } = await requireParentContext(request);
      await ensureParentOwnsSession(parent.id, params.id);

      const messages = await listSessionMessages({
        sessionId: params.id,
        visibility: "all",
        limit
      });

      return NextResponse.json({ messages, visibility: "all" });
    } catch (parentError) {
      if (!(parentError instanceof ApiError) || parentError.status !== 401) {
        throw parentError;
      }

      await requireChildSessionContext(request, params.id);
      const messages = await listSessionMessages({
        sessionId: params.id,
        visibility: "child",
        limit
      });

      return NextResponse.json({ messages, visibility: "child" });
    }
  } catch (error) {
    return handleRouteError(error, "messages_fetch_failed");
  }
}
