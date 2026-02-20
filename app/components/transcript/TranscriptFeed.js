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
  actorLabels = null,
  enableWindowing = true,
  windowSize = 120,
  windowStep = 120,
  chatMode = false
}) {
  const normalizedWindowSize = Math.max(20, Number.parseInt(String(windowSize || 0), 10) || 120);
  const normalizedWindowStep = Math.max(20, Number.parseInt(String(windowStep || 0), 10) || 120);
  const [announcement, setAnnouncement] = useState("");
  const [visibleCount, setVisibleCount] = useState(() => {
    if (!enableWindowing) {
      return messages.length;
    }
    return Math.min(messages.length, normalizedWindowSize);
  });
  const previousMessageCountRef = useRef(messages.length);
  const windowPreviousCountRef = useRef(messages.length);
  const previousPendingRef = useRef(pending);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    if (chatMode && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, pending, chatMode]);

  const resolveLabel = (actorType) => {
    const fromMap = actorLabels ? actorLabels[actorType] : null;
    if (fromMap) {
      return fromMap;
    }

    return defaultActorLabel(actorType);
  };

  useEffect(() => {
    const previousCount = windowPreviousCountRef.current;
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

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;

    if (!enableWindowing) {
      setVisibleCount(messages.length);
      return;
    }

    setVisibleCount((previousVisibleCount) => {
      if (messages.length <= normalizedWindowSize) {
        return messages.length;
      }

      if (previousCount === 0) {
        return normalizedWindowSize;
      }

      // If user expanded to full history, keep full history visible as new messages arrive.
      if (previousVisibleCount >= previousCount) {
        return messages.length;
      }

      const delta = messages.length - previousCount;
      if (delta > 0) {
        // Preserve relative window position by appending newly added rows.
        return Math.min(messages.length, previousVisibleCount + delta);
      }

      return Math.min(messages.length, Math.max(normalizedWindowSize, previousVisibleCount));
    });
    windowPreviousCountRef.current = messages.length;
  }, [enableWindowing, messages.length, normalizedWindowSize]);

  const hiddenCount = enableWindowing ? Math.max(0, messages.length - visibleCount) : 0;
  const visibleMessages = hiddenCount > 0 ? messages.slice(hiddenCount) : messages;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {hiddenCount > 0 ? (
        <div className="message-feed__window-controls">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setVisibleCount((previousVisibleCount) => Math.min(messages.length, previousVisibleCount + normalizedWindowStep));
            }}
          >
            Show older messages ({hiddenCount} hidden)
          </button>
        </div>
      ) : null}
      <div
        className={chatMode ? "chat-mode-feed" : "message-feed"}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-busy={pending}
      >
        {messages.length === 0 ? (
          <p className="empty-state">{emptyText}</p>
        ) : (
          visibleMessages.map((message) => {
            if (chatMode) {
              return (
                <article key={message.id} className={`chat-bubble-wrapper chat-bubble-wrapper--${message.actor_type}`}>
                  {message.actor_type !== "child" ? (
                    <span className="chat-bubble-meta">{resolveLabel(message.actor_type)}</span>
                  ) : null}
                  <div className={`chat-bubble chat-bubble--${message.actor_type}`}>
                    {message.content}
                  </div>
                </article>
              );
            }
            return (
              <article key={message.id} className={`message-row message-row--${message.actor_type}`}>
                <div className="message-row__meta">
                  <span className="pill">{resolveLabel(message.actor_type)}</span>
                  {showVisibilityScope ? (
                    <span className="pill pill--muted">{resolveVisibilityScopeLabel(message.visibility_scope)}</span>
                  ) : null}
                </div>
                <p className="message-row__body">{message.content}</p>
              </article>
            );
          })
        )}
        {pending ? (
          chatMode ? (
            <article className="chat-bubble-wrapper chat-bubble-wrapper--assistant">
              <span className="chat-bubble-meta">{resolveLabel("assistant")}</span>
              <div className="chat-bubble chat-bubble--assistant pulse">{pendingText}</div>
            </article>
          ) : (
            <p className="empty-state">{pendingText}</p>
          )
        ) : null}
        {chatMode ? <div ref={endOfMessagesRef} /> : null}
      </div>
      {enableWindowing && hiddenCount === 0 && messages.length > normalizedWindowSize && visibleCount > normalizedWindowSize ? (
        <div className="message-feed__window-controls">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const recentCount = Math.min(messages.length, normalizedWindowSize);
              setVisibleCount(recentCount);
              setAnnouncement(`Showing most recent ${recentCount} messages.`);
            }}
          >
            Show recent only
          </button>
        </div>
      ) : null}
    </>
  );
}
