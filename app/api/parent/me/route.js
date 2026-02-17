import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../src/server/auth.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";

export async function GET(request) {
  try {
    const context = await requireParentContext(request);

    return NextResponse.json({
      parent: context.parent,
      user: {
        id: context.user.id,
        email: context.user.email ?? null
      }
    });
  } catch (error) {
    return handleRouteError(error, "parent_profile_failed");
  }
}
