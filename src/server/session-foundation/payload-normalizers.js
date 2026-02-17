import { ApiError } from "../api-error.js";
import { normalizeJoinCode } from "../session-codes.js";

function optionalText(value, maxLength = 2000) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function ensureString(value, fieldName, maxLength = 120) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new ApiError(400, "validation_error", `${fieldName} is required.`);
  }

  return trimmed.slice(0, maxLength);
}

function ensureAge(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 21) {
    throw new ApiError(400, "validation_error", "age must be an integer between 4 and 21.");
  }

  return parsed;
}

function ensureSubjects(value, fieldName = "subjects") {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "validation_error", `${fieldName} must be an array of strings.`);
  }

  const normalized = value
    .map((subject) => String(subject || "").trim())
    .filter(Boolean)
    .map((subject) => subject.slice(0, 64));

  if (normalized.length === 0) {
    throw new ApiError(400, "validation_error", `${fieldName} must include at least one subject.`);
  }

  if (normalized.length > 20) {
    throw new ApiError(400, "validation_error", `${fieldName} may include at most 20 entries.`);
  }

  return normalized;
}

export function normalizeChildProfilePayload(payload = {}) {
  return {
    first_name: ensureString(payload.first_name ?? payload.child_name, "child_name", 80),
    age: ensureAge(payload.age),
    grade: ensureString(payload.grade, "grade", 32),
    subjects: ensureSubjects(payload.subjects, "subjects"),
    profile_notes: optionalText(payload.profile_notes ?? payload.personality_description, 2000),
    special_needs: optionalText(payload.special_needs, 2000)
  };
}

export function normalizeSessionStartPayload(payload = {}) {
  return {
    child_id: ensureString(payload.child_id, "child_id", 64),
    daily_subjects: ensureSubjects(payload.daily_subjects ?? payload.subjects_for_day, "daily_subjects"),
    parent_context: optionalText(payload.parent_context, 4000),
    goal_notes: optionalText(payload.goal_notes, 2000),
    additional_context: optionalText(payload.additional_context, 2000)
  };
}

export function normalizeSessionJoinPayload(payload = {}) {
  const code = normalizeJoinCode(payload.code);
  if (!code || code.length < 6) {
    throw new ApiError(400, "validation_error", "code is required and must be at least 6 alphanumeric characters.");
  }

  return {
    code,
    device_fingerprint: optionalText(payload.device_fingerprint, 256)
  };
}
