const DIRECT_ANSWER_PATTERNS = [
  /^the answer is\b/i,
  /^it(?:'| i)?s\s+\d+/i,
  /\bfinal answer\b/i,
  /\btherefore,?\s+the answer\b/i,
  /\bsolve(?:d)?\s+result\b/i
];

const UNSAFE_CONTENT_PATTERNS = [
  /\bself-harm\b/i,
  /\bsuicide\b/i,
  /\bmake a bomb\b/i,
  /\bsexual\b/i,
  /\bexplicit\b/i
];

export function containsUnsafeContent(text) {
  if (!text) {
    return false;
  }
  return UNSAFE_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeComparisonText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

export function containsParentGuidanceLeak(assistantText, parentGuidance) {
  const normalizedAssistant = normalizeComparisonText(assistantText);
  const normalizedGuidance = normalizeComparisonText(parentGuidance);

  if (!normalizedAssistant || !normalizedGuidance) {
    return false;
  }

  // Ignore very short guidance fragments that can create noisy matches.
  if (normalizedGuidance.length < 18) {
    return false;
  }

  return normalizedAssistant.includes(normalizedGuidance);
}

export function looksLikeDirectAnswer(text) {
  if (!text) {
    return false;
  }

  const trimmed = text.trim();
  if (DIRECT_ANSWER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  return /(^|\s)\d+(\.\d+)?\s*$/.test(trimmed);
}

export function buildScaffoldHint(studentPrompt) {
  if (!studentPrompt || !studentPrompt.trim()) {
    return "Let’s solve this step by step. First, tell me what information you already know.";
  }

  return [
    "Let’s work through it together instead of jumping to the final answer.",
    `Start with this: what is the problem asking in your own words?`,
    `Then identify one fact or rule you can apply to \"${studentPrompt.trim()}\".`
  ].join(" ");
}

export function applyTutorGuardrails({
  assistantText,
  studentPrompt,
  parentGuidance,
  allowDirectAnswer
}) {
  const policyApplied = [];
  let finalText = (assistantText || "").trim();

  if (!finalText) {
    finalText = "Tell me your current thinking, and I’ll guide you with the next step.";
    policyApplied.push("empty_response_fallback");
  }

  if (containsUnsafeContent(finalText)) {
    finalText = "I can’t help with that request. Let’s switch to a safe learning question.";
    policyApplied.push("unsafe_content_blocked");
  }

  if (containsParentGuidanceLeak(finalText, parentGuidance)) {
    finalText = "Let’s keep going one step at a time. Tell me what you notice first.";
    policyApplied.push("parent_guidance_redacted");
  }

  if (!allowDirectAnswer && looksLikeDirectAnswer(finalText)) {
    finalText = buildScaffoldHint(studentPrompt);
    policyApplied.push("scaffold_rewrite");
  }

  if (policyApplied.length === 0) {
    policyApplied.push("none");
  }

  return {
    assistantText: finalText,
    policyApplied
  };
}

export function buildTutorSystemPrompt({
  promptVersion,
  profile,
  dailyContext,
  allowDirectAnswer
}) {
  const profileText = profile ? JSON.stringify(profile) : "{}";
  const dayText = dailyContext ? JSON.stringify(dailyContext) : "{}";

  return [
    `Prompt-Version: ${promptVersion}`,
    "You are a homeschool tutoring assistant for minors.",
    "Default mode is scaffold-first: ask guiding questions, provide hints, and avoid direct final answers.",
    allowDirectAnswer
      ? "Direct answers are temporarily allowed for this turn by explicit parent override."
      : "Direct answers are not allowed unless explicit parent override is true.",
    "Maintain age-appropriate language and safe educational content.",
    "Parent guidance is private context and must not be exposed verbatim to the child.",
    `Student profile context: ${profileText}`,
    `Daily session context: ${dayText}`
  ].join("\n");
}
