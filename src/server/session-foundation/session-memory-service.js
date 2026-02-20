import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

const SESSION_MEMORY_VERSION = 1;
const SESSION_MEMORY_MAX_CHECKPOINTS = 10;
const SESSION_MEMORY_MAX_PENDING_QUESTIONS = 4;
const SESSION_MEMORY_MAX_PARENT_PRIORITIES = 6;
const SESSION_MEMORY_SUMMARY_MAX_CHARS = 420;
const SESSION_MEMORY_ITEM_MAX_CHARS = 180;
const SESSION_MEMORY_PARENT_PRIORITY_MAX_CHARS = 220;

function sanitizeText(rawValue, maxChars = SESSION_MEMORY_ITEM_MAX_CHARS) {
  const normalized = String(rawValue ?? "")
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

function firstSentence(rawValue, maxChars = SESSION_MEMORY_ITEM_MAX_CHARS) {
  const normalized = sanitizeText(rawValue, maxChars * 2);
  if (!normalized) {
    return "";
  }

  const sentenceBoundary = normalized.search(/[.!?](\s|$)/);
  if (sentenceBoundary > 0) {
    return sanitizeText(normalized.slice(0, sentenceBoundary + 1), maxChars);
  }

  return sanitizeText(normalized, maxChars);
}

function dedupeKeepRecent(values, maxCount) {
  const deduped = [];
  const seen = new Set();

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = String(values[index] ?? "").trim();
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
    if (deduped.length >= maxCount) {
      break;
    }
  }

  return deduped.reverse();
}

function normalizeStringArray(rawValue, maxCount, maxChars = SESSION_MEMORY_ITEM_MAX_CHARS) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return dedupeKeepRecent(rawValue.map((item) => sanitizeText(item, maxChars)).filter(Boolean), maxCount);
}

function extractAssistantQuestions(assistantText) {
  const normalized = String(assistantText ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized.split(/(?<=\?)/g).map((part) => sanitizeText(part)).filter(Boolean);
  return parts.filter((part) => part.includes("?"));
}

function buildMemorySummary({
  subjects,
  checkpoints,
  pendingQuestions,
  parentPriorities,
  latestParentGuidance
}) {
  const summaryParts = [];
  const parentHighlights = Array.isArray(parentPriorities) ? parentPriorities.slice(-2) : [];

  if (parentHighlights.length > 0) {
    summaryParts.push(`Parent priorities: ${parentHighlights.join(" ")}`);
  } else if (latestParentGuidance) {
    summaryParts.push(`Parent priority: ${latestParentGuidance}`);
  }

  if (subjects.length > 0) {
    summaryParts.push(`Focus subjects: ${subjects.join(", ")}.`);
  }

  if (checkpoints.length > 0) {
    summaryParts.push(`Recent progression: ${checkpoints.slice(-3).join(" ")}`);
  }

  if (pendingQuestions.length > 0) {
    summaryParts.push(`Open question: ${pendingQuestions[0]}`);
  }

  return sanitizeText(summaryParts.join(" "), SESSION_MEMORY_SUMMARY_MAX_CHARS);
}

export function normalizeSessionMemory(rawMemory) {
  const memory = rawMemory && typeof rawMemory === "object" ? rawMemory : {};

  return {
    version: SESSION_MEMORY_VERSION,
    updated_at: String(memory.updated_at ?? "").trim() || null,
    turn_count: Number.isInteger(memory.turn_count) && memory.turn_count > 0 ? memory.turn_count : 0,
    subjects: normalizeStringArray(memory.subjects, 6, 60),
    key_checkpoints: normalizeStringArray(memory.key_checkpoints, SESSION_MEMORY_MAX_CHECKPOINTS),
    pending_questions: normalizeStringArray(
      memory.pending_questions,
      SESSION_MEMORY_MAX_PENDING_QUESTIONS
    ),
    parent_priorities: normalizeStringArray(
      memory.parent_priorities,
      SESSION_MEMORY_MAX_PARENT_PRIORITIES,
      SESSION_MEMORY_PARENT_PRIORITY_MAX_CHARS
    ),
    latest_parent_guidance:
      sanitizeText(memory.latest_parent_guidance, SESSION_MEMORY_PARENT_PRIORITY_MAX_CHARS) || null,
    summary: sanitizeText(memory.summary, SESSION_MEMORY_SUMMARY_MAX_CHARS)
  };
}

export function buildNextSessionMemory({
  previousMemory,
  source,
  learnerInput,
  assistantText,
  policyApplied,
  dailyContext,
  updatedAt
}) {
  const nowIso = String(updatedAt ?? new Date().toISOString());
  const base = normalizeSessionMemory(previousMemory);
  const subjects = normalizeStringArray(
    Array.isArray(dailyContext?.daily_subjects) ? dailyContext.daily_subjects : base.subjects,
    6,
    60
  );

  const checkpoints = [...base.key_checkpoints];
  const safeAssistantFocus = firstSentence(assistantText, 140);
  if (source === "child-turn") {
    const safeLearnerFocus = firstSentence(learnerInput, 120);
    if (safeLearnerFocus) {
      checkpoints.push(`Learner focus: ${safeLearnerFocus}`);
    }
    if (safeAssistantFocus) {
      checkpoints.push(`Tutor guidance: ${safeAssistantFocus}`);
    }
  } else if (safeAssistantFocus) {
    checkpoints.push(`Tutor guidance: ${safeAssistantFocus}`);
  }

  const policies = Array.isArray(policyApplied) ? policyApplied.filter(Boolean) : [];
  if (policies.length > 0 && !policies.includes("none")) {
    checkpoints.push(`Guardrail actions: ${policies.join(", ")}`);
  }

  const normalizedCheckpoints = normalizeStringArray(
    checkpoints,
    SESSION_MEMORY_MAX_CHECKPOINTS
  );

  const pendingQuestions = normalizeStringArray(
    [...base.pending_questions, ...extractAssistantQuestions(assistantText)],
    SESSION_MEMORY_MAX_PENDING_QUESTIONS
  );
  const sessionParentContext = firstSentence(
    dailyContext?.parent_context,
    SESSION_MEMORY_PARENT_PRIORITY_MAX_CHARS
  );
  const parentPriorities = [...base.parent_priorities];
  if (sessionParentContext) {
    parentPriorities.push(`Session direction: ${sessionParentContext}`);
  }

  let latestParentGuidance = base.latest_parent_guidance ?? null;
  if (source === "parent-nudge") {
    const parentDirection = firstSentence(learnerInput, SESSION_MEMORY_PARENT_PRIORITY_MAX_CHARS);
    if (parentDirection) {
      parentPriorities.push(`Live nudge: ${parentDirection}`);
      latestParentGuidance = parentDirection;
    }
  }

  const normalizedParentPriorities = normalizeStringArray(
    parentPriorities,
    SESSION_MEMORY_MAX_PARENT_PRIORITIES,
    SESSION_MEMORY_PARENT_PRIORITY_MAX_CHARS
  );

  if (!latestParentGuidance && normalizedParentPriorities.length > 0) {
    latestParentGuidance = normalizedParentPriorities[normalizedParentPriorities.length - 1];
  }

  return {
    version: SESSION_MEMORY_VERSION,
    updated_at: nowIso,
    turn_count: base.turn_count + 1,
    subjects,
    key_checkpoints: normalizedCheckpoints,
    pending_questions: pendingQuestions,
    parent_priorities: normalizedParentPriorities,
    latest_parent_guidance: latestParentGuidance,
    summary: buildMemorySummary({
      subjects,
      checkpoints: normalizedCheckpoints,
      pendingQuestions,
      parentPriorities: normalizedParentPriorities,
      latestParentGuidance
    })
  };
}

export async function updateSessionTutorMemory(
  {
    sessionId,
    source,
    learnerInput,
    assistantText,
    policyApplied,
    dailyContext,
    existingMemory,
    updatedAt
  },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const { data: sessionRow, error: sessionError } = await serviceClient
    .from("sessions")
    .select("id, daily_context")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    throw new ApiError(500, "session_memory_lookup_failed", "Unable to read session memory state.");
  }

  const currentDailyContext =
    sessionRow.daily_context && typeof sessionRow.daily_context === "object"
      ? sessionRow.daily_context
      : {};
  const nextMemory = buildNextSessionMemory({
    previousMemory: existingMemory ?? currentDailyContext.session_memory,
    source,
    learnerInput,
    assistantText,
    policyApplied,
    dailyContext,
    updatedAt
  });

  const { error: updateError } = await serviceClient
    .from("sessions")
    .update({
      daily_context: {
        ...currentDailyContext,
        session_memory: nextMemory
      }
    })
    .eq("id", sessionId);

  if (updateError) {
    throw new ApiError(500, "session_memory_update_failed", "Unable to persist session memory state.");
  }

  return nextMemory;
}
