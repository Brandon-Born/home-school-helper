import {
  requireChildSessionContext,
  requireParentContext
} from "./auth.js";
import { ApiError } from "./api-error.js";
import { ensureParentOwnsSession } from "./session-foundation-service.js";

export async function resolveSessionViewerContext(request, sessionId, dependencies = {}) {
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const ensureOwnership = dependencies.ensureParentOwnsSession ?? ensureParentOwnsSession;

  try {
    const { parent } = await requireParent(request);
    await ensureOwnership(parent.id, sessionId);

    return {
      role: "parent",
      visibility: "all",
      parent_id: parent.id
    };
  } catch (parentError) {
    if (!(parentError instanceof ApiError) || parentError.status !== 401) {
      throw parentError;
    }

    const childContext = await requireChild(request, sessionId);

    return {
      role: "child",
      visibility: "child",
      child_id: childContext.tokenRow.child_id
    };
  }
}
