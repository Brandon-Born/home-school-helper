import { NextResponse } from "next/server";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { listSessionMessages } from "../../../../../src/server/session-foundation-service.js";
import { resolveSessionViewerContext } from "../../../../../src/server/session-viewer-context.js";

export function createMessagesGetHandler(dependencies = {}) {
  const resolveViewerContext = dependencies.resolveSessionViewerContext ?? resolveSessionViewerContext;
  const listMessages = dependencies.listSessionMessages ?? listSessionMessages;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request, { params }) {
    try {
      const url = new URL(request.url);
      const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);

      const viewerContext = await resolveViewerContext(request, params.id);
      const messages = await listMessages({
        sessionId: params.id,
        visibility: viewerContext.visibility,
        limit
      });

      return NextResponse.json({
        messages,
        visibility: viewerContext.visibility
      });
    } catch (error) {
      return onError(error, "messages_fetch_failed");
    }
  };
}

export const GET = createMessagesGetHandler();
