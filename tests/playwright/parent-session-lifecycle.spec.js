import { test } from "@playwright/test";
import {
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

  await openParentConsole(page);
  await createChildProfile(page, { childName });

  const started = await startSessionForChild(page, { childName, dailySubject: "Math" });
  const regeneratedCode = await regenerateCodeFromActiveCard(page, {
    childName,
    previousCode: started.joinCode
  });
  await rejoinSessionFromActiveCard(page, { childName, expectedCode: regeneratedCode });
  await endSessionFromActiveCard(page, { childName });
});
