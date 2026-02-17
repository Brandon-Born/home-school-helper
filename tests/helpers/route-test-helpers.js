import assert from "node:assert/strict";

export function createJsonRequest(url, payload, options = {}) {
  return new Request(url, {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    body: JSON.stringify(payload)
  });
}

export function createAudioFormRequest(
  url,
  { audioText = "audio-bytes", fileName = "utterance.webm", mimeType = "audio/webm", languageCode } = {}
) {
  const formData = new FormData();
  formData.append("audio", new Blob([audioText], { type: mimeType }), fileName);

  if (typeof languageCode === "string" && languageCode.trim()) {
    formData.append("language_code", languageCode.trim());
  }

  return new Request(url, {
    method: "POST",
    body: formData
  });
}

export async function assertApiErrorResponse(response, { status, error, message }) {
  assert.equal(response.status, status);
  const payload = await response.json();
  assert.deepEqual(payload, { error, message });
}

export function parseSseEvents(chunkText) {
  const blocks = chunkText.split("\n\n").filter(Boolean);
  const events = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    let eventName = "message";
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) {
      continue;
    }

    events.push({
      event: eventName,
      data: JSON.parse(dataLines.join("\n"))
    });
  }

  return events;
}
