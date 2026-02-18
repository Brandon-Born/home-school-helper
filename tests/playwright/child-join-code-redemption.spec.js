import { expect, test } from "@playwright/test";
import {
  createChildProfile,
  createUniqueChildName,
  endSessionFromActiveCard,
  openParentConsole,
  startSessionForChild
} from "./helpers/parent-console.js";

test("join code can be redeemed once and second redemption is rejected", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const childName = createUniqueChildName("PWChildJoin");
  let joinCode = "";

  await openParentConsole(page);
  await createChildProfile(page, { childName, subjects: "Reading, Science" });
  const started = await startSessionForChild(page, { childName, dailySubject: "Reading" });
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
    if (!page.isClosed()) {
      await endSessionFromActiveCard(page, { childName }).catch(() => {});
    }
  }
});
