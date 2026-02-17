export function initializeSpokenAssistantMessageIds(messages = []) {
  return new Set(messages.filter((message) => message.actor_type === "assistant").map((message) => message.id));
}

export function takeFreshAssistantMessages(incoming = [], spokenAssistantMessageIds) {
  const freshAssistantMessages = incoming.filter(
    (message) => message.actor_type === "assistant" && !spokenAssistantMessageIds.has(message.id)
  );

  for (const message of freshAssistantMessages) {
    spokenAssistantMessageIds.add(message.id);
  }

  return freshAssistantMessages;
}
