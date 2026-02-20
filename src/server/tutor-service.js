import { callAnthropic } from "./anthropic.js";
import { getTutorConfig } from "./config.js";
import {
  applyTutorGuardrails,
  buildTutorSystemPrompt
} from "./guardrails.js";
import { normalizeTextForSpeech } from "./tts-text.js";

const MAX_RECENT_PROMPT_MESSAGES = 8;
const MAX_PROMPT_MESSAGE_CHARS = 280;
const MAX_MEMORY_CHECKPOINTS = 6;
const MAX_MEMORY_PENDING_QUESTIONS = 3;
const MAX_MEMORY_PARENT_PRIORITIES = 4;

function sanitizePromptText(value, maxChars = MAX_PROMPT_MESSAGE_CHARS) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 1)}…`;
}

function normalizePromptMessages(recentMessages) {
  if (!Array.isArray(recentMessages)) {
    return [];
  }

  return recentMessages
    .filter((message) => message && typeof message === "object")
    .slice(-MAX_RECENT_PROMPT_MESSAGES)
    .map((message) => ({
      actor_type: String(message.actor_type ?? "").trim().toLowerCase(),
      content: sanitizePromptText(message.content, MAX_PROMPT_MESSAGE_CHARS)
    }))
    .filter((message) => message.content);
}

function normalizePromptSessionMemory(sessionMemory) {
  if (!sessionMemory || typeof sessionMemory !== "object") {
    return {
      summary: "",
      keyCheckpoints: [],
      pendingQuestions: [],
      parentPriorities: [],
      latestParentGuidance: ""
    };
  }

  const keyCheckpoints = Array.isArray(sessionMemory.key_checkpoints)
    ? sessionMemory.key_checkpoints
        .map((item) => sanitizePromptText(item, 180))
        .filter(Boolean)
        .slice(-MAX_MEMORY_CHECKPOINTS)
    : [];
  const pendingQuestions = Array.isArray(sessionMemory.pending_questions)
    ? sessionMemory.pending_questions
        .map((item) => sanitizePromptText(item, 180))
        .filter(Boolean)
        .slice(-MAX_MEMORY_PENDING_QUESTIONS)
    : [];
  const parentPriorities = Array.isArray(sessionMemory.parent_priorities)
    ? sessionMemory.parent_priorities
        .map((item) => sanitizePromptText(item, 220))
        .filter(Boolean)
        .slice(-MAX_MEMORY_PARENT_PRIORITIES)
    : [];

  return {
    summary: sanitizePromptText(sessionMemory.summary, 420),
    keyCheckpoints,
    pendingQuestions,
    parentPriorities,
    latestParentGuidance: sanitizePromptText(sessionMemory.latest_parent_guidance, 220)
  };
}

function hasPriorLearnerConversation(promptMessages) {
  return promptMessages.some((message) => message.actor_type === "child" || message.actor_type === "assistant");
}

function buildProfilePromptContext(profile, { hasPriorConversation } = {}) {
  if (!profile || typeof profile !== "object") {
    return {};
  }

  if (!hasPriorConversation) {
    return profile;
  }

  const summary = {};
  if (profile.age !== null && profile.age !== undefined && String(profile.age).trim() !== "") {
    summary.age = profile.age;
  }
  if (String(profile.grade ?? "").trim()) {
    summary.grade = String(profile.grade).trim();
  }
  if (Array.isArray(profile.subjects) && profile.subjects.length > 0) {
    summary.subjects = profile.subjects;
  }
  if (String(profile.profile_notes ?? "").trim()) {
    summary.profile_notes = sanitizePromptText(profile.profile_notes, 180);
  }
  if (String(profile.special_needs ?? "").trim()) {
    summary.special_needs = sanitizePromptText(profile.special_needs, 180);
  }

  return Object.keys(summary).length > 0 ? summary : {};
}

function formatPromptActor(actorType) {
  if (actorType === "assistant") {
    return "Tutor";
  }
  if (actorType === "child") {
    return "Learner";
  }
  if (actorType === "parent") {
    return "Parent";
  }
  return "Message";
}

function buildRecentTranscriptPrompt(promptMessages) {
  if (promptMessages.length === 0) {
    return "Recent visible transcript: none";
  }

  const lines = promptMessages.map(
    (message) => `${formatPromptActor(message.actor_type)}: ${message.content}`
  );

  return [
    "Recent visible transcript (oldest to newest):",
    ...lines
  ].join("\n");
}

function buildSessionMemoryPrompt(memory) {
  const summary = memory?.summary ?? "";
  const keyCheckpoints = Array.isArray(memory?.keyCheckpoints) ? memory.keyCheckpoints : [];
  const pendingQuestions = Array.isArray(memory?.pendingQuestions) ? memory.pendingQuestions : [];
  const parentPriorities = Array.isArray(memory?.parentPriorities) ? memory.parentPriorities : [];
  const latestParentGuidance = memory?.latestParentGuidance ?? "";

  if (
    !summary &&
    keyCheckpoints.length === 0 &&
    pendingQuestions.length === 0 &&
    parentPriorities.length === 0 &&
    !latestParentGuidance
  ) {
    return "Rolling session memory: none yet";
  }

  const lines = ["Rolling session memory:"];

  if (summary) {
    lines.push(`Summary: ${summary}`);
  }

  if (keyCheckpoints.length > 0) {
    lines.push("Key checkpoints:");
    for (const checkpoint of keyCheckpoints) {
      lines.push(`- ${checkpoint}`);
    }
  }

  if (pendingQuestions.length > 0) {
    lines.push("Pending questions:");
    for (const question of pendingQuestions) {
      lines.push(`- ${question}`);
    }
  }

  if (parentPriorities.length > 0 || latestParentGuidance) {
    lines.push("Private parent steering memory:");
    for (const priority of parentPriorities) {
      lines.push(`- Priority: ${priority}`);
    }
    if (latestParentGuidance) {
      lines.push(`Latest direction: ${latestParentGuidance}`);
    }
  }

  return lines.join("\n");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLearnerFirstName(profile) {
  const full = String(profile?.first_name ?? "").trim();
  if (!full) {
    return "";
  }

  return full.split(/\s+/)[0];
}

function deRepeatLeadingLearnerName(assistantText, { profile, promptMessages } = {}) {
  const firstName = extractLearnerFirstName(profile);
  if (!firstName) {
    return assistantText;
  }

  const priorAssistant = [...(promptMessages ?? [])]
    .reverse()
    .find((message) => message.actor_type === "assistant" && message.content);
  if (!priorAssistant) {
    return assistantText;
  }

  const leadPattern = new RegExp(`^\\s*${escapeRegExp(firstName)}\\s*[,!:\\-]\\s*`, "i");
  if (!leadPattern.test(assistantText) || !leadPattern.test(priorAssistant.content)) {
    return assistantText;
  }

  const cleaned = assistantText.replace(leadPattern, "").trim();
  return cleaned || assistantText;
}

function buildSourceInputPrompt(source, inputText) {
  if (source === "parent-nudge") {
    return `Parent side message: ${inputText || "(no parent side message provided)"}`;
  }

  if (source === "child-turn") {
    return `Learner message: ${inputText || "(no learner message provided)"}`;
  }

  return `Message: ${inputText || "(no message provided)"}`;
}

function buildResponseAudiencePrompt(source) {
  if (source === "parent-nudge") {
    return "Response audience: parent only (private side-channel acknowledgement).";
  }

  return "Response audience: learner (child-visible tutoring turn).";
}

function buildUserPrompt({ source, studentInput, parentGuidance, promptMessages, sessionMemory }) {
  const inputText = studentInput?.trim() || "";
  const guidanceText = parentGuidance?.trim() || "";

  return [
    `Source: ${source}`,
    buildResponseAudiencePrompt(source),
    guidanceText
      ? `Private parent direction (authoritative): ${guidanceText}`
      : "Private parent direction (authoritative): none",
    buildSessionMemoryPrompt(sessionMemory),
    buildRecentTranscriptPrompt(promptMessages),
    buildSourceInputPrompt(source, inputText)
  ].join("\n");
}

export async function generateTutorTurn({
  sessionId,
  source,
  studentInput,
  parentGuidance,
  profile,
  dailyContext,
  sessionMemory,
  recentMessages,
  allowDirectAnswer = false,
  modelCaller = callAnthropic,
  configOverride
}) {
  const config = configOverride ?? getTutorConfig();
  const promptMessages = normalizePromptMessages(recentMessages);
  const promptSessionMemory = normalizePromptSessionMemory(sessionMemory);
  const hasPriorConversation = hasPriorLearnerConversation(promptMessages);
  const profileForPrompt = buildProfilePromptContext(profile, { hasPriorConversation });

  const systemPrompt = buildTutorSystemPrompt({
    promptVersion: config.promptVersion,
    profile: profileForPrompt,
    dailyContext,
    allowDirectAnswer
  });

  const userPrompt = buildUserPrompt({
    source,
    studentInput,
    parentGuidance,
    promptMessages,
    sessionMemory: promptSessionMemory
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
    allowDirectAnswer,
    source
  });

  const assistantText =
    source === "child-turn"
      ? deRepeatLeadingLearnerName(guarded.assistantText, {
          profile,
          promptMessages
        })
      : guarded.assistantText;

  return {
    assistant_text: assistantText,
    speak_payload: {
      text: normalizeTextForSpeech(assistantText),
      voice: "default",
      mode: "hybrid_tts"
    },
    policy_applied: guarded.policyApplied,
    model_used: config.model
  };
}
