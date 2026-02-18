import { NextResponse } from "next/server";
import { requireParentContext } from "../../../../src/server/auth.js";
import {
    updateChildForParent,
    deleteChildForParent
} from "../../../../src/server/session-foundation-service.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const payload = await request.json();
        const { parent } = await requireParentContext(request);
        const child = await updateChildForParent(parent.id, id, payload);

        return NextResponse.json({ child });
    } catch (error) {
        return handleRouteError(error, "child_update_failed");
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const { parent } = await requireParentContext(request);
        await deleteChildForParent(parent.id, id);

        return NextResponse.json({ deleted: true });
    } catch (error) {
        return handleRouteError(error, "child_delete_failed");
    }
}
