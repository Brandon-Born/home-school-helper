import { expect, test } from "@playwright/test";
import {
  cleanupFixtureData,
  createChildProfile,
  createUniqueChildName,
  openParentConsole,
  startSessionForChild
} from "./helpers/parent-console.js";

async function joinAsChild({ request, baseUrl, joinCode }) {
  const joinResponse = await request.post(`${baseUrl}/api/session/join`, {
    data: { code: joinCode }
  });
  expect(joinResponse.status()).toBe(200);
  const joinPayload = await joinResponse.json();
  const childToken = joinPayload?.session_access?.child_session_token;
  expect(childToken).toBeTruthy();
  return childToken;
}

async function fetchChildVisibleMessages({ request, baseUrl, sessionId, childToken }) {
  const response = await request.get(`${baseUrl}/api/session/${sessionId}/messages?limit=200`, {
    headers: {
      authorization: `Bearer ${childToken}`
    }
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  return Array.isArray(payload?.messages) ? payload.messages : [];
}

async function fetchParentVisibleMessages({ request, baseUrl, sessionId, parentAuthHeader }) {
  const response = await request.get(`${baseUrl}/api/session/${sessionId}/messages?limit=200`, {
    headers: {
      authorization: parentAuthHeader
    }
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  return Array.isArray(payload?.messages) ? payload.messages : [];
}

test("parent nudge acknowledgement stays private while child tutoring remains normal", async ({ page, browser }) => {
  test.setTimeout(90_000);

  const childName = createUniqueChildName("PWParentPrivate");
  const fixture = {
    childName,
    childId: null,
    sessionId: null
  };
  let childContext = null;

  try {
    await openParentConsole(page);
    const created = await createChildProfile(page, { childName, subjects: "Math, Reading" });
    fixture.childId = created.childId;
    const started = await startSessionForChild(page, {
      childName,
      dailySubject: "Math",
      parentContext: "Default to calm scaffolded pacing."
    });
    fixture.sessionId = started.sessionId;

    const baseUrl = new URL(page.url()).origin;
    childContext = await browser.newContext();
    const childToken = await joinAsChild({
      request: childContext.request,
      baseUrl,
      joinCode: started.joinCode
    });

    const nudgeText = `Private nudge ${Date.now()}: slow down and praise effort first.`;
    const nudgeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/session/${fixture.sessionId}/parent-nudge`) &&
        response.request().method() === "POST"
    );

    await page.getByLabel("Private nudge for tutor").fill(nudgeText);
    await page.getByRole("button", { name: "Send", exact: true }).click();

    const nudgeResponse = await nudgeResponsePromise;
    expect(nudgeResponse.status()).toBe(200);
    const nudgePayload = await nudgeResponse.json();

    expect(nudgePayload?.input_message?.visibility_scope).toBe("parent_only");
    expect(nudgePayload?.assistant_message?.visibility_scope).toBe("parent_only");
    expect(nudgePayload?.assistant_text).toBeTruthy();

    const privateAssistantId = nudgePayload?.assistant_message?.id;
    const privateParentInputId = nudgePayload?.input_message?.id;
    expect(privateAssistantId).toBeTruthy();
    expect(privateParentInputId).toBeTruthy();
    const parentAuthHeader = nudgeResponse.request().headers()["authorization"];
    expect(parentAuthHeader).toBeTruthy();

    const parentVisibleAfterNudge = await fetchParentVisibleMessages({
      request: childContext.request,
      baseUrl,
      sessionId: fixture.sessionId,
      parentAuthHeader
    });

    const privateParentInput = parentVisibleAfterNudge.find((message) => message.id === privateParentInputId);
    const privateAssistantMessage = parentVisibleAfterNudge.find((message) => message.id === privateAssistantId);
    expect(privateParentInput?.visibility_scope).toBe("parent_only");
    expect(privateAssistantMessage?.visibility_scope).toBe("parent_only");

    const childVisibleAfterNudge = await fetchChildVisibleMessages({
      request: childContext.request,
      baseUrl,
      sessionId: fixture.sessionId,
      childToken
    });

    expect(childVisibleAfterNudge.every((message) => message.visibility_scope === "child_and_parent")).toBeTruthy();
    expect(childVisibleAfterNudge.some((message) => message.id === privateAssistantId)).toBeFalsy();
    expect(
      childVisibleAfterNudge.some((message) =>
        String(message?.content || "").toLowerCase().includes("private nudge")
      )
    ).toBeFalsy();

    const childTurnResponse = await childContext.request.post(
      `${baseUrl}/api/session/${fixture.sessionId}/child-turn`,
      {
        headers: {
          authorization: `Bearer ${childToken}`
        },
        data: {
          student_input: "Can you help me simplify 8/12?"
        }
      }
    );
    expect(childTurnResponse.status()).toBe(200);
    const childTurnPayload = await childTurnResponse.json();
    expect(childTurnPayload?.assistant_text).toBeTruthy();
    expect(childTurnPayload?.assistant_message?.visibility_scope).toBe("child_and_parent");

    const childVisibleAfterTurn = await fetchChildVisibleMessages({
      request: childContext.request,
      baseUrl,
      sessionId: fixture.sessionId,
      childToken
    });
    const childAssistantId = childTurnPayload?.assistant_message?.id;
    expect(childAssistantId).toBeTruthy();
    expect(childVisibleAfterTurn.some((message) => message.id === childAssistantId)).toBeTruthy();
    expect(childVisibleAfterTurn.some((message) => message.id === privateAssistantId)).toBeFalsy();
  } finally {
    if (childContext) {
      await childContext.close().catch(() => {});
    }
    await cleanupFixtureData(page, fixture).catch(() => {});
  }
});
