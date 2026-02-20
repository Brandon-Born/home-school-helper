import { ApiError } from "../../../../../src/server/api-error.js";
import { requireChildSessionContext } from "../../../../../src/server/auth.js";
import {
  getSessionTutorContext
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { runSessionRoute } from "../../../../../src/server/session-route-helpers.js";
import { runSessionTutorTurn } from "../../../../../src/server/session-turn-orchestrator.js";

const MAX_STUDENT_INPUT_LENGTH = 4000;

function parseStudentInput(payload) {
  const text = String(payload?.student_input ?? "").trim();
  if (!text) {
    throw new ApiError(400, "validation_error", "student_input is required.");
  }

  if (text.length > MAX_STUDENT_INPUT_LENGTH) {
    throw new ApiError(
      413,
      "payload_too_large",
      `student_input must be at most ${MAX_STUDENT_INPUT_LENGTH} characters.`
    );
  }

  return text;
}

export function createChildTurnPostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const getTutorContext = dependencies.getSessionTutorContext ?? getSessionTutorContext;
  const runTurn = dependencies.runSessionTutorTurn ?? runSessionTutorTurn;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    return runSessionRoute({
      request,
      params,
      fallbackCode: "child_turn_failed",
      onError,
      run: async ({ sessionId }) => {
      await applyRateLimit(request, buildRateLimitPolicy("childTurn", sessionId));

      const payload = await request.json();
      const studentInput = parseStudentInput(payload);
      const childContext = await requireChild(request, sessionId);
      const tutorContext = await getTutorContext({
        sessionId,
        childId: childContext.tokenRow.child_id
      });

        const result = await runTurn({
        sessionId,
        source: "child-turn",
        studentInput,
        parentGuidance: tutorContext.latestParentGuidance,
        profile: tutorContext.profile,
        dailyContext: tutorContext.dailyContext,
        allowDirectAnswer: tutorContext.allowDirectAnswer,
        inputActorType: "child",
        inputVisibilityScope: "child_and_parent"
      });

      return Response.json(result);
      }
    });
  };
}

export const POST = createChildTurnPostHandler();
