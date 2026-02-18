const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;

export function normalizeTextForSpeech(rawText) {
  let text = String(rawText || "").trim();
  if (!text) {
    return "";
  }

  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/(^|\s)(#{1,6}\s*)/gm, "$1")
    .replace(/(^|\n)\s*>\s*/g, "$1")
    .replace(/(^|\n)\s*[-*+]\s+/g, "$1")
    .replace(/(^|\n)\s*\d+\.\s+/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(EMOJI_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}
