import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { runSessionRoute } from "../../../../../src/server/session-route-helpers.js";
import { setSessionDirectAnswerOverride } from "../../../../../src/server/session-foundation-service.js";

export function createOverridePostHandler(dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const setOverride = dependencies.setSessionDirectAnswerOverride ?? setSessionDirectAnswerOverride;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    return runSessionRoute({
      request,
      params,
      fallbackCode: "override_update_failed",
      onError,
      run: async ({ sessionId }) => {
      const payload = await request.json();
      const { parent } = await requireParent(request);

      const result = await setOverride({
        sessionId,
        parentId: parent.id,
        enabled: Boolean(payload.enabled),
        durationMinutes: payload.duration_minutes
      });

      return Response.json({ override: result });
      }
    });
  };
}

export const POST = createOverridePostHandler();
