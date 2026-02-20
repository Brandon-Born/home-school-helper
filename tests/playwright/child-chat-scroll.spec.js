import { test, expect } from "@playwright/test";
import {
    openParentConsole,
    createChildProfile,
    startSessionForChild,
    createUniqueChildName,
    cleanupFixtureData
} from "./helpers/parent-console.js";

test.describe("Child Chat Scroll Verification", () => {
    let fixture = { childId: null, childName: null, sessionId: null };
    let joinCode;

    test.beforeEach(async ({ page, browser }) => {
        const childName = createUniqueChildName("ScrollTest");
        fixture.childName = childName;

        await openParentConsole(page);
        const created = await createChildProfile(page, { childName, subjects: "Math" });
        fixture.childId = created.childId;

        const started = await startSessionForChild(page, { childName, dailySubject: "Math" });
        fixture.sessionId = started.sessionId;
        joinCode = started.joinCode;
    });

    test.afterEach(async ({ page }) => {
        await cleanupFixtureData(page, fixture);
    });

    test("chat container allows upward scrolling when content overflows", async ({ page }) => {
        // 1. Join the session as a child
        await page.goto("/child");
        await page.getByLabel("Your code").fill(joinCode);
        await page.getByRole("button", { name: "Let's go!" }).click();

        // Wait for the chat layout to load
        const messageContainer = page.locator('.child-chat-layout__messages');
        await expect(messageContainer).toBeVisible();

        // 2. Inject a large spacer to force overflow without needing many network requests
        await messageContainer.evaluate((el) => {
            const spacer = document.createElement("div");
            spacer.style.height = "3000px";
            spacer.style.flexShrink = "0";
            spacer.textContent = "Bottom of message";
            const feed = el.querySelector(".chat-mode-feed");
            if (feed) {
                feed.appendChild(spacer);
            } else {
                el.appendChild(spacer);
            }
            // Scroll to the absolute bottom so we can test scrolling UP
            el.scrollTop = el.scrollHeight;
        });

        // 3. Verify overflow and scrollability
        const scrollState = await messageContainer.evaluate((el) => {
            return {
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                scrollTop: el.scrollTop
            };
        });

        // The content should be taller than the container
        expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
        // It should be scrolled down
        expect(scrollState.scrollTop).toBeGreaterThan(0);

        // 4. Scroll up to the top
        await messageContainer.evaluate((el) => {
            el.scrollTop = 0;
        });

        // Verify it actually scrolled up
        const newScrollState = await messageContainer.evaluate((el) => {
            return {
                scrollTop: el.scrollTop
            };
        });

        // The scroll position should now be at the top (0)
        expect(newScrollState.scrollTop).toBe(0);
    });
});
