import { ApiError } from "../../../../../src/server/api-error.js";
import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import {
  ensureParentOwnsSession,
  getSessionTutorContext
} from "../../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { runSessionRoute } from "../../../../../src/server/session-route-helpers.js";
import { runSessionTutorTurn } from "../../../../../src/server/session-turn-orchestrator.js";

const MAX_PARENT_NUDGE_LENGTH = 2000;

function parseParentNudge(payload) {
  const nudgeText = String(payload?.nudge_text ?? "").trim();
  if (!nudgeText) {
    throw new ApiError(400, "validation_error", "nudge_text is required.");
  }

  if (nudgeText.length > MAX_PARENT_NUDGE_LENGTH) {
    throw new ApiError(
      413,
      "payload_too_large",
      `nudge_text must be at most ${MAX_PARENT_NUDGE_LENGTH} characters.`
    );
  }

  const parentGuidanceRaw = String(payload?.parent_guidance ?? nudgeText).trim();
  const parentGuidance =
    parentGuidanceRaw.length > MAX_PARENT_NUDGE_LENGTH
      ? parentGuidanceRaw.slice(0, MAX_PARENT_NUDGE_LENGTH)
      : parentGuidanceRaw;

  return {
    nudgeText,
    parentGuidance
  };
}

export function createParentNudgePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const ensureOwnsSession = dependencies.ensureParentOwnsSession ?? ensureParentOwnsSession;
  const getTutorContext = dependencies.getSessionTutorContext ?? getSessionTutorContext;
  const runTurn = dependencies.runSessionTutorTurn ?? runSessionTutorTurn;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    return runSessionRoute({
      request,
      params,
      fallbackCode: "parent_nudge_failed",
      onError,
      run: async ({ sessionId }) => {
      await applyRateLimit(request, buildRateLimitPolicy("parentNudge", sessionId));

      const payload = await request.json();
      const { nudgeText, parentGuidance } = parseParentNudge(payload);
      const { parent } = await requireParent(request);

      await ensureOwnsSession(parent.id, sessionId);
      const tutorContext = await getTutorContext({
        sessionId,
        parentId: parent.id
      });

      const result = await runTurn({
        sessionId,
        source: "parent-nudge",
        studentInput: nudgeText,
        parentGuidance,
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
      }
    });
  };
}

export const POST = createParentNudgePostHandler();
