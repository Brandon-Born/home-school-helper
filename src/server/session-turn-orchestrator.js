import {
  persistSessionMessage,
  persistTutorAuditEvents
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
    allowDirectAnswer,
    inputActorType,
    inputVisibilityScope
  },
  dependencies = {}
) {
  const generateTurn = dependencies.generateTutorTurn ?? generateTutorTurn;
  const persistMessage = dependencies.persistSessionMessage ?? persistSessionMessage;
  const persistAuditEvents = dependencies.persistTutorAuditEvents ?? persistTutorAuditEvents;
  const getConfig = dependencies.getTutorConfig ?? getTutorConfig;

  const result = await generateTurn({
    sessionId,
    source,
    studentInput,
    parentGuidance,
    profile,
    dailyContext,
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
    visibilityScope: "child_and_parent",
    content: result.assistant_text,
    policyFlags: result.policy_applied
  });

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
          visibility_scope: "child_and_parent",
          content: result.assistant_text,
          policy_flags: result.policy_applied,
          created_at: assistantMessageRow.created_at
        }
      : null
  };
}
