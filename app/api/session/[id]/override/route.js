import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { setSessionDirectAnswerOverride } from "../../../../../src/server/session-foundation-service.js";

export function createOverridePostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const setOverride = dependencies.setSessionDirectAnswerOverride ?? setSessionDirectAnswerOverride;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    try {
      const { id: sessionId } = await params;
      const payload = await request.json();
      const { parent } = await requireParent(request);

      const result = await setOverride({
        sessionId,
        parentId: parent.id,
        enabled: Boolean(payload.enabled),
        durationMinutes: payload.duration_minutes
      });

      return Response.json({ override: result });
    } catch (error) {
      return onError(error, "override_update_failed");
    }
  };
}

export const POST = createOverridePostHandler();
