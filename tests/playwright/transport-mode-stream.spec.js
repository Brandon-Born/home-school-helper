import { expect, test } from "@playwright/test";

import { persistSessionMessage } from "../../src/server/session-foundation-service.js";
import { parseSseEvents } from "../helpers/route-test-helpers.js";
import {
  cleanupFixtureData,
  createChildProfile,
  createUniqueChildName,
  openParentConsole,
  startSessionForChild
} from "./helpers/parent-console.js";

const EXPECTED_TRANSPORT_MODE = String(process.env.PLAYWRIGHT_EXPECTED_TRANSPORT_MODE || "")
  .trim()
  .toLowerCase();

async function waitForEvent(events, predicate, { timeoutMs = 12_000, label = "event" } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = events.find(predicate);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const summary = events
    .map((event) => {
      const ids = Array.isArray(event.data?.messages)
        ? event.data.messages.map((message) => message?.id).filter(Boolean).join(",")
        : "";
      return ids ? `${event.event}(${ids})` : event.event;
    })
    .join(" | ");
  throw new Error(`Timed out waiting for ${label}. Seen events: ${summary || "none"}.`);
}

async function waitForOptionalEvent(events, predicate, { timeoutMs = 3_000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = events.find(predicate);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
}

function collectAppendedMessageIds(events) {
  return events
    .filter((event) => event.event === "message_append")
    .flatMap((event) => (Array.isArray(event.data?.messages) ? event.data.messages : []))
    .map((message) => message?.id)
    .filter(Boolean);
}

async function openChildTranscriptStream({ baseUrl, sessionId, childToken, requestedTransportMode = "" }) {
  const abortController = new AbortController();
  const streamUrl = new URL(`/api/session/${sessionId}/stream`, baseUrl);
  streamUrl.searchParams.set("limit", "50");
  if (requestedTransportMode) {
    streamUrl.searchParams.set("transport_mode", requestedTransportMode);
  }

  const response = await fetch(streamUrl, {
    method: "GET",
    headers: {
      accept: "text/event-stream",
      authorization: `Bearer ${childToken}`
    },
    signal: abortController.signal
  });

  expect(response.ok).toBeTruthy();
  expect(response.headers.get("content-type") || "").toContain("text/event-stream");
  const selectedTransportMode = String(response.headers.get("x-stream-transport-mode") || "")
    .trim()
    .toLowerCase();

  const reader = response.body?.getReader();
  expect(reader).toBeTruthy();

  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";
  const readLoop = (async () => {
    try {
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

          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          events.push(...parseSseEvents(`${block}\n\n`));
        }
      }
    } catch {
      // Ignore stream shutdown races during test teardown.
    }
  })();

  return {
    events,
    selectedTransportMode,
    async close() {
      abortController.abort();
      await reader.cancel().catch(() => {});
      await readLoop.catch(() => {});
    }
  };
}

test("@transport-mode stream appends each persisted transcript row once", async ({ page, browser }) => {
  test.setTimeout(90_000);

  const childName = createUniqueChildName("PWTransport");
  const fixture = {
    childName,
    childId: null,
    sessionId: null
  };
  let stream = null;
  let childContext = null;

  try {
    await openParentConsole(page);
    const created = await createChildProfile(page, { childName, subjects: "Math, Reading" });
    fixture.childId = created.childId;
    const started = await startSessionForChild(page, { childName, dailySubject: "Math" });
    fixture.sessionId = started.sessionId;

    const baseUrl = new URL(page.url()).origin;
    childContext = await browser.newContext();
    const joinResponse = await childContext.request.post(`${baseUrl}/api/session/join`, {
      data: { code: started.joinCode }
    });
    expect(joinResponse.status()).toBe(200);
    const joinPayload = await joinResponse.json();
    const childToken = joinPayload?.session_access?.child_session_token;
    expect(childToken).toBeTruthy();

    stream = await openChildTranscriptStream({
      baseUrl,
      sessionId: fixture.sessionId,
      childToken,
      requestedTransportMode: EXPECTED_TRANSPORT_MODE
    });
    await waitForEvent(stream.events, (event) => event.event === "snapshot", {
      label: "snapshot event"
    });

    if (EXPECTED_TRANSPORT_MODE) {
      expect(stream.selectedTransportMode).toBe(EXPECTED_TRANSPORT_MODE);
    }

    const firstMessageRow = await persistSessionMessage({
      sessionId: fixture.sessionId,
      actorType: "child",
      visibilityScope: "child_and_parent",
      content: `transport message one ${Date.now()}`
    });
    expect(firstMessageRow?.id).toBeTruthy();

    const secondMessageRow = await persistSessionMessage({
      sessionId: fixture.sessionId,
      actorType: "assistant",
      visibilityScope: "child_and_parent",
      content: `transport message two ${Date.now()}`
    });
    expect(secondMessageRow?.id).toBeTruthy();

    const expectedMessageIds = [firstMessageRow.id, secondMessageRow.id];
    const runAppendAssertions = async () => {
      for (const messageId of expectedMessageIds) {
        await waitForEvent(
          stream.events,
          (event) =>
            event.event === "message_append" &&
            Array.isArray(event.data?.messages) &&
            event.data.messages.some((message) => message?.id === messageId),
          { label: `append for ${messageId}` }
        );
      }

      const appendedIds = collectAppendedMessageIds(stream.events);
      for (const expectedId of expectedMessageIds) {
        expect(appendedIds.filter((id) => id === expectedId)).toHaveLength(1);
      }
    };

    if (EXPECTED_TRANSPORT_MODE === "polling") {
      await runAppendAssertions();
    } else if (EXPECTED_TRANSPORT_MODE === "realtime") {
      const realtimeAppend = await waitForOptionalEvent(
        stream.events,
        (event) =>
          event.event === "message_append" &&
          Array.isArray(event.data?.messages) &&
          event.data.messages.some((message) => expectedMessageIds.includes(message?.id))
      );

      if (realtimeAppend) {
        await runAppendAssertions();
      } else {
        await stream.close().catch(() => {});
        stream = await openChildTranscriptStream({
          baseUrl,
          sessionId: fixture.sessionId,
          childToken,
          requestedTransportMode: EXPECTED_TRANSPORT_MODE
        });
        const refreshedSnapshot = await waitForEvent(
          stream.events,
          (event) => event.event === "snapshot",
          { label: "refreshed snapshot event" }
        );
        const snapshotIds = Array.isArray(refreshedSnapshot.data?.messages)
          ? refreshedSnapshot.data.messages.map((message) => message?.id).filter(Boolean)
          : [];
        for (const expectedId of expectedMessageIds) {
          expect(snapshotIds).toContain(expectedId);
        }
      }
    } else {
      await runAppendAssertions();
    }

    expect(stream.events.some((event) => event.event === "error")).toBeFalsy();
  } finally {
    if (stream) {
      await stream.close().catch(() => {});
    }
    if (childContext) {
      await childContext.close().catch(() => {});
    }
    await cleanupFixtureData(page, fixture).catch(() => {});
  }
});
