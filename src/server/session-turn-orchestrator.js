import {
  persistSessionMessage,
  persistTutorAuditEvents,
  updateSessionTutorMemory
} from "./session-foundation-service.js";
import { generateTutorTurn } from "./tutor-service.js";
import { getTutorConfig } from "./config.js";

export async function runSessionTutorTurn(
  {
    sessionId,
    source,
    studentInput,
    parentGuidance,
    profile,
    dailyContext,
    sessionMemory,
    recentMessages,
    allowDirectAnswer,
    inputActorType,
    inputVisibilityScope,
    assistantVisibilityScope = "child_and_parent"
  },
  dependencies = {}
) {
  const generateTurn = dependencies.generateTutorTurn ?? generateTutorTurn;
  const persistMessage = dependencies.persistSessionMessage ?? persistSessionMessage;
  const persistAuditEvents = dependencies.persistTutorAuditEvents ?? persistTutorAuditEvents;
  const persistSessionMemory = dependencies.updateSessionTutorMemory ?? updateSessionTutorMemory;
  const getConfig = dependencies.getTutorConfig ?? getTutorConfig;

  const result = await generateTurn({
    sessionId,
    source,
    studentInput,
    parentGuidance,
    profile,
    dailyContext,
    sessionMemory,
    recentMessages,
    allowDirectAnswer
  });

  const tutorConfig = getConfig();

  const inputMessageRow = await persistMessage({
    sessionId,
    actorType: inputActorType,
    visibilityScope: inputVisibilityScope,
    content: studentInput
  });

  const assistantMessageRow = await persistMessage({
    sessionId,
    actorType: "assistant",
    visibilityScope: assistantVisibilityScope,
    content: result.assistant_text,
    policyFlags: result.policy_applied
  });

  try {
    await persistSessionMemory({
      sessionId,
      source,
      learnerInput: studentInput,
      assistantText: result.assistant_text,
      policyApplied: result.policy_applied,
      dailyContext,
      existingMemory: sessionMemory,
      updatedAt: assistantMessageRow?.created_at
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown");
    console.warn(`[session-memory] update failed for ${sessionId}: ${message}`);
  }

  await persistAuditEvents({
    sessionId,
    source,
    modelUsed: result.model_used,
    promptVersion: tutorConfig.promptVersion,
    policyApplied: result.policy_applied
  });

  return {
    ...result,
    input_message: inputMessageRow
      ? {
          id: inputMessageRow.id,
          actor_type: inputActorType,
          visibility_scope: inputVisibilityScope,
          content: String(studentInput || "").trim(),
          created_at: inputMessageRow.created_at
        }
      : null,
    assistant_message: assistantMessageRow
      ? {
          id: assistantMessageRow.id,
          actor_type: "assistant",
          visibility_scope: assistantVisibilityScope,
          content: result.assistant_text,
          policy_flags: result.policy_applied,
          created_at: assistantMessageRow.created_at
        }
      : null
  };
}
