import { NextResponse } from "next/server";
import { requireChildSessionContext } from "../../../../../src/server/auth.js";
import {
  getSessionTutorContext,
  persistSessionMessage
} from "../../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import { generateTutorTurn } from "../../../../../src/server/tutor-service.js";

export async function POST(request, { params }) {
  try {
    const payload = await request.json();
    const childContext = await requireChildSessionContext(request, params.id);
    const tutorContext = await getSessionTutorContext({
      sessionId: params.id,
      childId: childContext.tokenRow.child_id
    });

    const result = await generateTutorTurn({
      sessionId: params.id,
      source: "child-turn",
      studentInput: payload.student_input,
      parentGuidance: tutorContext.latestParentGuidance,
      profile: tutorContext.profile,
      dailyContext: tutorContext.dailyContext,
      allowDirectAnswer: tutorContext.allowDirectAnswer
    });

    await persistSessionMessage({
      sessionId: params.id,
      actorType: "child",
      visibilityScope: "child_and_parent",
      content: payload.student_input
    });

    await persistSessionMessage({
      sessionId: params.id,
      actorType: "assistant",
      visibilityScope: "child_and_parent",
      content: result.assistant_text,
      policyFlags: result.policy_applied
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "child_turn_failed");
  }
}
