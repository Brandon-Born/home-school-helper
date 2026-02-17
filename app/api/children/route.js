import { NextResponse } from "next/server";
import { requireParentContext } from "../../../src/server/auth.js";
import {
  createChildForParent,
  listChildrenForParent
} from "../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../src/server/route-errors.js";

export async function GET(request) {
  try {
    const { parent } = await requireParentContext(request);
    const children = await listChildrenForParent(parent.id);
    return NextResponse.json({ children });
  } catch (error) {
    return handleRouteError(error, "children_fetch_failed");
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const { parent } = await requireParentContext(request);
    const child = await createChildForParent(parent.id, payload);

    return NextResponse.json({ child }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "child_create_failed");
  }
}
