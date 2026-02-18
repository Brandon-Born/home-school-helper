import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import {
  ensureParentOwnsSession,
  getSessionTutorContext
} from "../../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { runSessionTutorTurn } from "../../../../../src/server/session-turn-orchestrator.js";

export function createParentNudgePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const ensureOwnsSession = dependencies.ensureParentOwnsSession ?? ensureParentOwnsSession;
  const getTutorContext = dependencies.getSessionTutorContext ?? getSessionTutorContext;
  const runTurn = dependencies.runSessionTutorTurn ?? runSessionTutorTurn;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    try {
      const { id: sessionId } = await params;
      applyRateLimit(request, buildRateLimitPolicy("parentNudge", sessionId));

      const payload = await request.json();
      const { parent } = await requireParent(request);

      await ensureOwnsSession(parent.id, sessionId);
      const tutorContext = await getTutorContext({
        sessionId,
        parentId: parent.id
      });

      const result = await runTurn({
        sessionId,
        source: "parent-nudge",
        studentInput: payload.nudge_text,
        parentGuidance: payload.parent_guidance ?? payload.nudge_text,
        profile: tutorContext.profile,
        dailyContext: tutorContext.dailyContext,
        allowDirectAnswer: tutorContext.allowDirectAnswer,
        inputActorType: "parent",
        inputVisibilityScope: "parent_only"
      });

      return Response.json({
        ...result,
        queued: true
      });
    } catch (error) {
      return onError(error, "parent_nudge_failed");
    }
  };
}

export const POST = createParentNudgePostHandler();
