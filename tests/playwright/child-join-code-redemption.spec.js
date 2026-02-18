import { expect, test } from "@playwright/test";
import {
  cleanupFixtureData,
  createChildProfile,
  createUniqueChildName,
  openParentConsole,
  startSessionForChild
} from "./helpers/parent-console.js";

test("join code can be redeemed once and second redemption is rejected", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const childName = createUniqueChildName("PWChildJoin");
  const fixture = {
    childName,
    childId: null,
    sessionId: null
  };
  let joinCode = "";

  await openParentConsole(page);
  const created = await createChildProfile(page, { childName, subjects: "Reading, Science" });
  fixture.childId = created.childId;
  const started = await startSessionForChild(page, { childName, dailySubject: "Reading" });
  fixture.sessionId = started.sessionId;
  joinCode = started.joinCode;

  const baseUrl = new URL(page.url()).origin;
  const childContext = await browser.newContext();

  try {
    const firstJoinResponse = await childContext.request.post(`${baseUrl}/api/session/join`, {
      data: {
        code: joinCode
      }
    });
    expect(firstJoinResponse.status()).toBe(200);
    const firstJoinPayload = await firstJoinResponse.json();
    expect(firstJoinPayload.session_access.session_id).toBeTruthy();
    expect(firstJoinPayload.session_access.child_session_token).toBeTruthy();

    const secondJoinResponse = await childContext.request.post(`${baseUrl}/api/session/join`, {
      data: {
        code: joinCode
      }
    });
    expect(secondJoinResponse.status()).toBe(409);
    const secondJoinPayload = await secondJoinResponse.json();
    expect(secondJoinPayload.error).toBe("session_code_used");
  } finally {
    await childContext.close().catch(() => {});
    await cleanupFixtureData(page, fixture).catch(() => {});
  }
});
