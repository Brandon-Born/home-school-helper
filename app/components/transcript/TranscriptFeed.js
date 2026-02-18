"use client";

function defaultActorLabel(actorType) {
  if (actorType === "assistant") {
    return "Sidekick";
  }

  if (actorType === "parent") {
    return "Parent";
  }

  if (actorType === "child") {
    return "Child";
  }

  return "System";
}

function resolveVisibilityScopeLabel(visibilityScope) {
  if (visibilityScope === "parent_only") {
    return "Parent only";
  }

  if (visibilityScope === "child_and_parent") {
    return "Shared with child";
  }

  return "System";
}

export function TranscriptFeed({
  messages,
  pending = false,
  pendingText = "Working on it...",
  emptyText = "No messages yet — ask a question to begin!",
  showVisibilityScope = false,
  actorLabels = null
}) {
  const resolveLabel = (actorType) => {
    const fromMap = actorLabels ? actorLabels[actorType] : null;
    if (fromMap) {
      return fromMap;
    }

    return defaultActorLabel(actorType);
  };

  return (
    <div className="message-feed">
      {messages.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        messages.map((message) => (
          <article key={message.id} className={`message-row message-row--${message.actor_type}`}>
            <div className="message-row__meta">
              <span className="pill">{resolveLabel(message.actor_type)}</span>
              {showVisibilityScope ? (
                <span className="pill pill--muted">{resolveVisibilityScopeLabel(message.visibility_scope)}</span>
              ) : null}
            </div>
            <p className="message-row__body">{message.content}</p>
          </article>
        ))
      )}
      {pending ? <p className="empty-state">{pendingText}</p> : null}
    </div>
  );
}
