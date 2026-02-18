const encoder = new TextEncoder();

export function serializeSse(event, payload) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function toCursor(message) {
  return {
    createdAt: String(message?.created_at || ""),
    id: String(message?.id || "")
  };
}

function compareCursorValues(leftCursor, rightCursor) {
  const leftTime = Date.parse(leftCursor.createdAt);
  const rightTime = Date.parse(rightCursor.createdAt);

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (leftCursor.createdAt !== rightCursor.createdAt) {
    return leftCursor.createdAt > rightCursor.createdAt ? 1 : -1;
  }

  if (leftCursor.id === rightCursor.id) {
    return 0;
  }

  return leftCursor.id > rightCursor.id ? 1 : -1;
}

function isAfterCursor(message, cursor) {
  if (!cursor) {
    return true;
  }

  return compareCursorValues(toCursor(message), cursor) > 0;
}

function normalizeTransportMode(rawValue) {
  const value = String(rawValue || "auto").trim().toLowerCase();
  if (value === "realtime" || value === "polling") {
    return value;
  }
  return "auto";
}

function filterByVisibility(messages, visibility) {
  if (visibility !== "child") {
    return messages;
  }

  return messages.filter((message) => message?.visibility_scope === "child_and_parent");
}

export async function startTranscriptStreamRuntime({
  writer,
  sessionId,
  visibility,
  limit,
  listSessionMessages,
  createSessionMessageSubscription = null,
  setTimer = (callback, interval) => setInterval(callback, interval),
  clearTimer = (timerId) => clearInterval(timerId),
  pollIntervalMs = 1800,
  keepAliveIntervalMs = 12000,
  logStreamEvent = () => {},
  streamTransportMode = null
}) {
  let closed = false;
  let isPolling = false;
  let seenIds = new Set();
  let lastSeenCursor = null;
  let streamHadPollError = false;
  let pollTimer = null;
  let keepAliveTimer = null;
  let unsubscribeMessages = null;
  let activeTransport = "none";
  let realtimeSubscribeAttempts = 0;
  let realtimeSubscribeSuccess = 0;
  let realtimeUnsubscribeCount = 0;
  const connectedAtMs = Date.now();
  const desiredTransportMode = normalizeTransportMode(streamTransportMode);

  const initialSnapshotRows = await listSessionMessages({
    sessionId,
    visibility,
    limit,
    order: "desc"
  });
  const initialMessages = [...initialSnapshotRows].reverse();

  for (const message of initialMessages) {
    seenIds.add(message.id);
    lastSeenCursor = toCursor(message);
  }

  // Do not block handler return on initial backpressure; stream consumer may not be attached yet.
  void writer
    .write(
      serializeSse("snapshot", {
        visibility,
        messages: initialMessages
      })
    )
    .catch(() => {
      // Ignore early backpressure/teardown races before reader attaches.
    });

  const appendFreshMessages = async (messages) => {
    if (closed || !Array.isArray(messages) || messages.length === 0) {
      return;
    }

    const fresh = filterByVisibility(messages, visibility)
      .filter((message) => message?.id)
      .sort((left, right) => compareCursorValues(toCursor(left), toCursor(right)))
      .filter((message) => isAfterCursor(message, lastSeenCursor) && !seenIds.has(message.id));

    if (fresh.length === 0) {
      return;
    }

    for (const message of fresh) {
      seenIds.add(message.id);
      lastSeenCursor = toCursor(message);
    }

    if (seenIds.size > 5000) {
      const recentIds = fresh.slice(-400).map((message) => message.id);
      if (lastSeenCursor?.id) {
        recentIds.push(lastSeenCursor.id);
      }
      seenIds = new Set(recentIds.filter(Boolean));
    }

    await writer.write(serializeSse("message_append", { messages: fresh }));
  };

  const poll = async () => {
    if (closed || isPolling) {
      return;
    }

    isPolling = true;
    let pollFailed = false;

    try {
      const messages = await listSessionMessages({
        sessionId,
        visibility,
        limit,
        order: "asc",
        afterCreatedAt: lastSeenCursor?.createdAt ?? null
      });
      await appendFreshMessages(messages);
    } catch (error) {
      pollFailed = true;
      streamHadPollError = true;
      logStreamEvent("warn", {
        event: "stream_poll_error",
        session_id: sessionId,
        visibility,
        error_message: error instanceof Error ? error.message : "Stream polling failed."
      });
      await writer.write(
        serializeSse("error", {
          message: error instanceof Error ? error.message : "Stream polling failed."
        })
      );
    } finally {
      if (!pollFailed && streamHadPollError) {
        streamHadPollError = false;
        logStreamEvent("info", {
          event: "stream_poll_recovered",
          session_id: sessionId,
          visibility
        });
      }
      isPolling = false;
    }
  };

  const startPollingTransport = (reason) => {
    if (closed || pollTimer) {
      return;
    }

    activeTransport = "polling";
    pollTimer = setTimer(poll, pollIntervalMs);
    logStreamEvent("info", {
      event: "stream_transport_connected",
      session_id: sessionId,
      visibility,
      mode: "polling",
      reason
    });
  };

  const startRealtimeTransport = async () => {
    if (typeof createSessionMessageSubscription !== "function") {
      throw new Error("Realtime stream transport is unavailable.");
    }

    realtimeSubscribeAttempts += 1;
    logStreamEvent("info", {
      event: "stream_realtime_subscribe",
      session_id: sessionId,
      visibility,
      status: "attempt",
      subscribe_attempts: realtimeSubscribeAttempts,
      subscribe_success: realtimeSubscribeSuccess,
      unsubscribe_count: realtimeUnsubscribeCount
    });

    unsubscribeMessages = await createSessionMessageSubscription({
      sessionId,
      onMessage: async (message) => {
        await appendFreshMessages([message]);
      },
      onError: async (error) => {
        if (closed) {
          return;
        }

        logStreamEvent("warn", {
          event: "stream_realtime_error",
          session_id: sessionId,
          visibility,
          error_message: error instanceof Error ? error.message : "Realtime stream error."
        });

        if (desiredTransportMode === "auto" && !pollTimer) {
          if (unsubscribeMessages) {
            try {
              await unsubscribeMessages();
              realtimeUnsubscribeCount += 1;
              logStreamEvent("info", {
                event: "stream_realtime_unsubscribe",
                session_id: sessionId,
                visibility,
                subscribe_attempts: realtimeSubscribeAttempts,
                subscribe_success: realtimeSubscribeSuccess,
                unsubscribe_count: realtimeUnsubscribeCount,
                reason: "realtime_error_fallback"
              });
            } catch {
              // Ignore unsubscribe errors during fallback.
            } finally {
              unsubscribeMessages = null;
            }
          }
          startPollingTransport("realtime_error");
        }
      }
    });

    activeTransport = "realtime";
    realtimeSubscribeSuccess += 1;
    logStreamEvent("info", {
      event: "stream_realtime_subscribe",
      session_id: sessionId,
      visibility,
      status: "subscribed",
      subscribe_attempts: realtimeSubscribeAttempts,
      subscribe_success: realtimeSubscribeSuccess,
      unsubscribe_count: realtimeUnsubscribeCount
    });
    logStreamEvent("info", {
      event: "stream_transport_connected",
      session_id: sessionId,
      visibility,
      mode: "realtime"
    });
  };

  if (desiredTransportMode === "polling") {
    startPollingTransport("configured_polling");
  } else {
    try {
      await startRealtimeTransport();
    } catch (error) {
      logStreamEvent("warn", {
        event: "stream_transport_failed",
        session_id: sessionId,
        visibility,
        mode: "realtime",
        error_message: error instanceof Error ? error.message : "Realtime transport failed."
      });

      if (desiredTransportMode === "realtime") {
        throw error;
      }

      startPollingTransport("realtime_unavailable");
    }
  }

  keepAliveTimer = setTimer(async () => {
    if (closed) {
      return;
    }

    try {
      await writer.write(encoder.encode(":keep-alive\n\n"));
    } catch {
      // Ignore keep-alive write failures during teardown.
    }
  }, keepAliveIntervalMs);

  return {
    close: async (reason = "server_close") => {
      if (closed) {
        return;
      }

      closed = true;
      if (pollTimer) {
        clearTimer(pollTimer);
      }
      if (keepAliveTimer) {
        clearTimer(keepAliveTimer);
      }
      if (unsubscribeMessages) {
        try {
          await unsubscribeMessages();
          realtimeUnsubscribeCount += 1;
          logStreamEvent("info", {
            event: "stream_realtime_unsubscribe",
            session_id: sessionId,
            visibility,
            subscribe_attempts: realtimeSubscribeAttempts,
            subscribe_success: realtimeSubscribeSuccess,
            unsubscribe_count: realtimeUnsubscribeCount
          });
        } catch {
          // Realtime subscription already closed.
        }
      }

      try {
        await writer.close();
      } catch {
        // Stream already closed.
      }

      logStreamEvent("info", {
        event: "stream_disconnect",
        session_id: sessionId,
        visibility,
        transport: activeTransport,
        realtime_subscribe_attempts: realtimeSubscribeAttempts,
        realtime_subscribe_success: realtimeSubscribeSuccess,
        realtime_unsubscribe_count: realtimeUnsubscribeCount,
        reason,
        connection_duration_ms: Date.now() - connectedAtMs
      });
    }
  };
}
