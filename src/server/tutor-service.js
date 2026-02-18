import { callAnthropic } from "./anthropic.js";
import { getTutorConfig } from "./config.js";
import {
  applyTutorGuardrails,
  buildTutorSystemPrompt
} from "./guardrails.js";
import { normalizeTextForSpeech } from "./tts-text.js";

function buildUserPrompt({ source, studentInput, parentGuidance }) {
  const inputText = studentInput?.trim() || "";
  const guidanceText = parentGuidance?.trim() || "";

  return [
    `Source: ${source}`,
    guidanceText ? `Hidden parent guidance: ${guidanceText}` : "Hidden parent guidance: none",
    `Learner message: ${inputText || "(no learner message provided)"}`
  ].join("\n");
}

export async function generateTutorTurn({
  sessionId,
  source,
  studentInput,
  parentGuidance,
  profile,
  dailyContext,
  allowDirectAnswer = false,
  modelCaller = callAnthropic,
  configOverride
}) {
  const config = configOverride ?? getTutorConfig();

  const systemPrompt = buildTutorSystemPrompt({
    promptVersion: config.promptVersion,
    profile,
    dailyContext,
    allowDirectAnswer
  });

  const userPrompt = buildUserPrompt({
    source,
    studentInput,
    parentGuidance
  });

  const modelResponse = await modelCaller({
    config,
    systemPrompt,
    userPrompt,
    metadata: {
      sessionId,
      route: source
    }
  });

  const guarded = applyTutorGuardrails({
    assistantText: modelResponse.text,
    studentPrompt: studentInput,
    parentGuidance,
    allowDirectAnswer
  });

  return {
    assistant_text: guarded.assistantText,
    speak_payload: {
      text: normalizeTextForSpeech(guarded.assistantText),
      voice: "default",
      mode: "hybrid_tts"
    },
    policy_applied: guarded.policyApplied,
    model_used: config.model
  };
}
