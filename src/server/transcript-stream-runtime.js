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

export async function startTranscriptStreamRuntime({
  writer,
  sessionId,
  visibility,
  limit,
  listSessionMessages,
  setTimer = (callback, interval) => setInterval(callback, interval),
  clearTimer = (timerId) => clearInterval(timerId),
  pollIntervalMs = 1800,
  keepAliveIntervalMs = 12000
}) {
  let closed = false;
  let isPolling = false;
  let seenIds = new Set();
  let lastSeenCursor = null;

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

  const poll = async () => {
    if (closed || isPolling) {
      return;
    }

    isPolling = true;

    try {
      const messages = await listSessionMessages({
        sessionId,
        visibility,
        limit,
        order: "asc",
        afterCreatedAt: lastSeenCursor?.createdAt ?? null
      });

      const fresh = messages.filter((message) => isAfterCursor(message, lastSeenCursor) && !seenIds.has(message.id));
      if (fresh.length > 0) {
        for (const message of fresh) {
          seenIds.add(message.id);
          lastSeenCursor = toCursor(message);
        }

        if (seenIds.size > 5000) {
          seenIds = new Set(messages.slice(-400).map((message) => message.id));
        }

        await writer.write(serializeSse("message_append", { messages: fresh }));
      }
    } catch (error) {
      await writer.write(
        serializeSse("error", {
          message: error instanceof Error ? error.message : "Stream polling failed."
        })
      );
    } finally {
      isPolling = false;
    }
  };

  const pollTimer = setTimer(poll, pollIntervalMs);
  const keepAliveTimer = setTimer(async () => {
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
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      clearTimer(pollTimer);
      clearTimer(keepAliveTimer);

      try {
        await writer.close();
      } catch {
        // Stream already closed.
      }
    }
  };
}
