import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import {
  ensureParentOwnsSession,
  getSessionTutorContext,
  persistSessionMessage
} from "../../../../../src/server/session-foundation-service.js";
import { generateTutorTurn } from "../../../../../src/server/tutor-service.js";

export async function POST(request, { params }) {
  try {
    const payload = await request.json();
    const { parent } = await requireParentContext(request);

    await ensureParentOwnsSession(parent.id, params.id);
    const tutorContext = await getSessionTutorContext({
      sessionId: params.id,
      parentId: parent.id
    });

    const result = await generateTutorTurn({
      sessionId: params.id,
      source: "parent-nudge",
      studentInput: payload.nudge_text,
      parentGuidance: payload.parent_guidance ?? payload.nudge_text,
      profile: tutorContext.profile,
      dailyContext: tutorContext.dailyContext,
      allowDirectAnswer: tutorContext.allowDirectAnswer
    });

    await persistSessionMessage({
      sessionId: params.id,
      actorType: "parent",
      visibilityScope: "parent_only",
      content: payload.nudge_text
    });

    await persistSessionMessage({
      sessionId: params.id,
      actorType: "assistant",
      visibilityScope: "child_and_parent",
      content: result.assistant_text,
      policyFlags: result.policy_applied
    });

    return NextResponse.json({
      ...result,
      queued: true
    });
  } catch (error) {
    return handleRouteError(error, "parent_nudge_failed");
  }
}
