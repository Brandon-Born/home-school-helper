import { expect, test } from "@playwright/test";
import {
  cleanupFixtureData,
  createChildProfile,
  createUniqueChildName,
  endSessionFromActiveCard,
  openParentConsole,
  regenerateCodeFromActiveCard,
  rejoinSessionFromActiveCard,
  startSessionForChild
} from "./helpers/parent-console.js";

test("parent can create, regenerate, rejoin, and end a session without metadata drift", async ({ page }) => {
  const childName = createUniqueChildName("PWLifecycle");
  const fixture = {
    childName,
    childId: null,
    sessionId: null
  };

  try {
    await openParentConsole(page);
    const created = await createChildProfile(page, { childName });
    fixture.childId = created.childId;

    const started = await startSessionForChild(page, { childName, dailySubject: "Math" });
    fixture.sessionId = started.sessionId;
    const regeneratedCode = await regenerateCodeFromActiveCard(page, {
      sessionId: fixture.sessionId,
      previousCode: started.joinCode
    });

    await rejoinSessionFromActiveCard(page, { sessionId: fixture.sessionId, expectedCode: regeneratedCode });
    await endSessionFromActiveCard(page, { sessionId: fixture.sessionId });
  } finally {
    await cleanupFixtureData(page, fixture).catch(() => {});
  }
});
