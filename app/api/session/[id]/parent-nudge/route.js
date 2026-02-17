import { NextResponse } from "next/server";
import { enqueueTutorUtterance } from "../../../../../src/server/session-events.js";
import { generateTutorTurn } from "../../../../../src/server/tutor-service.js";

export async function POST(request, { params }) {
  try {
    const payload = await request.json();

    const result = await generateTutorTurn({
      sessionId: params.id,
      source: "parent-nudge",
      studentInput: payload.nudge_text,
      parentGuidance: payload.parent_guidance ?? payload.nudge_text,
      profile: payload.profile,
      dailyContext: payload.daily_context,
      allowDirectAnswer: Boolean(payload.allow_direct_answer)
    });

    enqueueTutorUtterance(params.id, {
      type: "session.tutor.speak",
      data: result.speak_payload
    });

    return NextResponse.json({
      ...result,
      queued: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "parent_nudge_failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 400 }
    );
  }
}
