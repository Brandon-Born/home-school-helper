import { NextResponse } from "next/server";
import { requireChildSessionContext } from "../../../../../src/server/auth.js";
import {
  getSessionTutorContext
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { runSessionTutorTurn } from "../../../../../src/server/session-turn-orchestrator.js";

export async function POST(request, { params }) {
  try {
    enforceRateLimit(request, buildRateLimitPolicy("childTurn", params.id));

    const payload = await request.json();
    const childContext = await requireChildSessionContext(request, params.id);
    const tutorContext = await getSessionTutorContext({
      sessionId: params.id,
      childId: childContext.tokenRow.child_id
    });

    const result = await runSessionTutorTurn({
      sessionId: params.id,
      source: "child-turn",
      studentInput: payload.student_input,
      parentGuidance: tutorContext.latestParentGuidance,
      profile: tutorContext.profile,
      dailyContext: tutorContext.dailyContext,
      allowDirectAnswer: tutorContext.allowDirectAnswer,
      inputActorType: "child",
      inputVisibilityScope: "child_and_parent"
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "child_turn_failed");
  }
}
