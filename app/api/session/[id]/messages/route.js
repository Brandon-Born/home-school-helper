import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { listSessionMessages } from "../../../../../src/server/session-foundation-service.js";
import { resolveSessionViewerContext } from "../../../../../src/server/session-viewer-context.js";

export function createMessagesGetHandler(dependencies = {}) {
  const resolveViewerContext = dependencies.resolveSessionViewerContext ?? resolveSessionViewerContext;
  const listMessages = dependencies.listSessionMessages ?? listSessionMessages;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function GET(request, { params }) {
    try {
      const { id: sessionId } = await params;
      const url = new URL(request.url);
      const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);

      const viewerContext = await resolveViewerContext(request, sessionId);
      const messages = await listMessages({
        sessionId,
        visibility: viewerContext.visibility,
        limit
      });

      return Response.json({
        messages,
        visibility: viewerContext.visibility
      });
    } catch (error) {
      return onError(error, "messages_fetch_failed");
    }
  };
}

export const GET = createMessagesGetHandler();
