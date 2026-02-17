export class EventStreamError extends Error {
  constructor(message, { status = null, code = null, payload = null } = {}) {
    super(message);
    this.name = "EventStreamError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function openEventStream({ path, bearerToken, onEvent, signal }) {
  const headers = {
    accept: "text/event-stream"
  };

  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(path, {
    method: "GET",
    headers,
    cache: "no-store",
    signal
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    const parsed = parsePossiblyJson(text);
    const message =
      parsed?.message ||
      (typeof parsed === "string" && parsed.trim()) ||
      `Stream request failed with status ${response.status}`;

    throw new EventStreamError(message, {
      status: response.status,
      code: parsed?.error || null,
      payload: parsed
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary === -1) {
        break;
      }

      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const eventPayload = parseEventBlock(rawEvent);
      if (eventPayload) {
        onEvent(eventPayload);
      }
    }
  }
}

function parsePossiblyJson(rawValue) {
  if (typeof rawValue !== "string") {
    return rawValue;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return rawValue;
  }
}

function parseEventBlock(block) {
  const lines = block.split("\n");
  let event = "message";
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join("\n");
  let parsedData = rawData;

  try {
    parsedData = JSON.parse(rawData);
  } catch {
    // Keep raw text payload when data is not JSON.
  }

  return {
    event,
    data: parsedData
  };
}
