import { NextResponse } from "next/server";
import { generateTutorTurn } from "../../../../../src/server/tutor-service.js";

export async function POST(request, { params }) {
  try {
    const payload = await request.json();
    const result = await generateTutorTurn({
      sessionId: params.id,
      source: "child-turn",
      studentInput: payload.student_input,
      parentGuidance: payload.parent_guidance,
      profile: payload.profile,
      dailyContext: payload.daily_context,
      allowDirectAnswer: Boolean(payload.allow_direct_answer)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "child_turn_failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 400 }
    );
  }
}
