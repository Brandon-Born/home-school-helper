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

  await persistMessage({
    sessionId,
    actorType: inputActorType,
    visibilityScope: inputVisibilityScope,
    content: studentInput
  });

  await persistMessage({
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

  return result;
}
