const encoder = new TextEncoder();

export function serializeSse(event, payload) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
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

  const initialMessages = await listSessionMessages({
    sessionId,
    visibility,
    limit
  });

  for (const message of initialMessages) {
    seenIds.add(message.id);
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
        limit
      });

      const fresh = messages.filter((message) => !seenIds.has(message.id));
      if (fresh.length > 0) {
        for (const message of fresh) {
          seenIds.add(message.id);
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
