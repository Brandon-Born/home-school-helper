"use client";

import { useEffect, useRef, useState } from "react";

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

function summarizeForAnnouncement(text, maxLength = 140) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Message received.";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
}

export function TranscriptFeed({
  messages,
  pending = false,
  pendingText = "Working on it...",
  emptyText = "No messages yet — ask a question to begin!",
  showVisibilityScope = false,
  actorLabels = null
}) {
  const [announcement, setAnnouncement] = useState("");
  const previousMessageCountRef = useRef(messages.length);
  const previousPendingRef = useRef(pending);

  const resolveLabel = (actorType) => {
    const fromMap = actorLabels ? actorLabels[actorType] : null;
    if (fromMap) {
      return fromMap;
    }

    return defaultActorLabel(actorType);
  };

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    const hasNewMessages = messages.length > previousCount;

    if (hasNewMessages && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      const actorLabel = resolveLabel(latestMessage?.actor_type);
      const preview = summarizeForAnnouncement(latestMessage?.content);
      setAnnouncement(`New ${actorLabel} message. ${preview}`);
    } else if (pending && !previousPendingRef.current) {
      setAnnouncement("Tutor is preparing a reply.");
    }

    previousMessageCountRef.current = messages.length;
    previousPendingRef.current = pending;
  }, [messages, pending, actorLabels]);

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div
        className="message-feed"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-busy={pending}
      >
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
    </>
  );
}
