"use client";

export function toList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mergeMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function buildSessionForUi(sessionData, children = [], previousSession = null) {
  if (!sessionData) {
    return null;
  }

  const childNameFromList = children.find((child) => child.id === sessionData.child_id)?.first_name;
  const startedAt = sessionData.started_at ?? previousSession?.started_at ?? new Date().toISOString();

  return {
    ...previousSession,
    ...sessionData,
    child_name: sessionData.child_name ?? childNameFromList ?? previousSession?.child_name ?? "Unknown",
    started_at: startedAt
  };
}

export const initialChildForm = {
  child_name: "",
  age: "",
  grade: "",
  subjects: "",
  personality_description: "",
  special_needs: ""
};

export const initialSessionForm = {
  daily_subjects: "",
  parent_context: "",
  goal_notes: "",
  additional_context: ""
};

export const initialLoadingState = {
  auth: false,
  refreshParentData: false,
  consent: false,
  childMutation: false,
  sessionStart: false,
  nudge: false,
  override: false,
  sessionManage: false
};

export const initialActionAlerts = {
  consent: null,
  childMutation: null,
  sessionStart: null,
  nudge: null,
  override: null,
  sessionManage: null
};
