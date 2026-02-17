import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../src/server/route-errors.js";
import {
  ensureParentOwnsSession,
  getSessionTutorContext
} from "../../../../../src/server/session-foundation-service.js";
import { enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { runSessionTutorTurn } from "../../../../../src/server/session-turn-orchestrator.js";

export async function POST(request, { params }) {
  try {
    enforceRateLimit(request, {
      scope: "parent_nudge",
      maxRequests: 30,
      windowMs: 60_000,
      keySuffix: params.id
    });

    const payload = await request.json();
    const { parent } = await requireParentContext(request);

    await ensureParentOwnsSession(parent.id, params.id);
    const tutorContext = await getSessionTutorContext({
      sessionId: params.id,
      parentId: parent.id
    });

    const result = await runSessionTutorTurn({
      sessionId: params.id,
      source: "parent-nudge",
      studentInput: payload.nudge_text,
      parentGuidance: payload.parent_guidance ?? payload.nudge_text,
      profile: tutorContext.profile,
      dailyContext: tutorContext.dailyContext,
      allowDirectAnswer: tutorContext.allowDirectAnswer,
      inputActorType: "parent",
      inputVisibilityScope: "parent_only"
    });

    return NextResponse.json({
      ...result,
      queued: true
    });
  } catch (error) {
    return handleRouteError(error, "parent_nudge_failed");
  }
}
