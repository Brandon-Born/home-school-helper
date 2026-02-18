import { requireChildSessionContext } from "../../../../../src/server/auth.js";
import {
  getSessionTutorContext
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { runSessionTutorTurn } from "../../../../../src/server/session-turn-orchestrator.js";

export function createChildTurnPostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const getTutorContext = dependencies.getSessionTutorContext ?? getSessionTutorContext;
  const runTurn = dependencies.runSessionTutorTurn ?? runSessionTutorTurn;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    try {
      const { id: sessionId } = await params;
      applyRateLimit(request, buildRateLimitPolicy("childTurn", sessionId));

      const payload = await request.json();
      const childContext = await requireChild(request, sessionId);
      const tutorContext = await getTutorContext({
        sessionId,
        childId: childContext.tokenRow.child_id
      });

      const result = await runTurn({
        sessionId,
        source: "child-turn",
        studentInput: payload.student_input,
        parentGuidance: tutorContext.latestParentGuidance,
        profile: tutorContext.profile,
        dailyContext: tutorContext.dailyContext,
        allowDirectAnswer: tutorContext.allowDirectAnswer,
        inputActorType: "child",
        inputVisibilityScope: "child_and_parent"
      });

      return Response.json(result);
    } catch (error) {
      return onError(error, "child_turn_failed");
    }
  };
}

export const POST = createChildTurnPostHandler();
