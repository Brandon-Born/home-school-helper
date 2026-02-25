import { expect, test } from "@playwright/test";
import { goToParentSection } from "./helpers/parent-console.js";

function jsonResponse(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

async function mockParentWorkspaceApis(page, {
  parent,
  children = [],
  sessions = [],
  billing,
  verificationUrl = null,
  checkoutUrl = null,
  portalUrl = null
} = {}) {
  await page.route("**/api/parent/me", async (route) => {
    await jsonResponse(route, {
      parent,
      user: {
        id: "auth_parent_1",
        email: parent.email ?? "parent@example.test"
      }
    });
  });

  await page.route("**/api/children", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await jsonResponse(route, { children });
  });

  await page.route("**/api/session/active", async (route) => {
    await jsonResponse(route, { sessions });
  });

  await page.route("**/api/privacy/child-data-summary", async (route) => {
    await jsonResponse(route, {
      summary: {
        generated_at: "2026-02-24T00:00:00.000Z",
        counts: {
          children: children.length,
          sessions: sessions.length,
          transcript_messages: 0,
          parent_only_messages: 0
        }
      }
    });
  });

  await page.route("**/api/privacy/requests", async (route) => {
    await jsonResponse(route, { requests: [] });
  });

  await page.route("**/api/billing/subscription", async (route) => {
    await jsonResponse(route, { billing });
  });

  if (verificationUrl) {
    await page.route("**/api/billing/verification-session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const origin = new URL(route.request().url()).origin;
      await jsonResponse(route, {
        verification: {
          id: "cs_verify_mock_123",
          url:
            verificationUrl === "__same_origin_parent_verification_success__"
              ? `${origin}/parent?billing=verification_success`
              : verificationUrl,
          verification_amount_cents: 100,
          verification_currency: "usd"
        }
      });
    });
  }

  if (checkoutUrl) {
    await page.route("**/api/billing/checkout-session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const origin = new URL(route.request().url()).origin;
      await jsonResponse(route, {
        checkout: {
          id: "cs_mock_123",
          url:
            checkoutUrl === "__same_origin_parent_success__"
              ? `${origin}/parent?billing=checkout_success`
              : checkoutUrl,
          intro_offer: {
            first_month_discount_coupon_applied: true
          }
        }
      });
    });
  }

  if (portalUrl) {
    await page.route("**/api/billing/portal-session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const origin = new URL(route.request().url()).origin;
      await jsonResponse(route, {
        portal: {
          url:
            portalUrl === "__same_origin_parent_portal_return__"
              ? `${origin}/parent?billing=portal_return`
              : portalUrl
        }
      });
    });
  }
}

test("homepage family plan section includes a direct signup CTA", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Family plan pricing" })).toBeVisible({ timeout: 30000 });
  const pricingCta = page.getByRole("link", { name: "Start family plan" });
  await expect(pricingCta).toBeVisible({ timeout: 30000 });
  await expect(pricingCta).toHaveAttribute("href", "/parent");
});

test("first-time onboarding starts subscription checkout when consent is pending", async ({ page }) => {
  await mockParentWorkspaceApis(page, {
    parent: {
      id: "parent_1",
      email: "parent@example.test",
      full_name: "Parent",
      coppa_consent_required: true,
      coppa_consent_status: "pending",
      coppa_policy_version: "2026-02-19"
    },
    billing: {
      enabled: true,
      provider: "stripe",
      subscription: null
    },
    checkoutUrl: "__same_origin_parent_success__"
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-trial-onboarding")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-section-link-managed")).toHaveCount(0);
  await expect(
    page.getByTestId("parent-trial-setup-card").getByRole("heading", { name: "Start for $1.99 (first month)" })
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Start subscription for $1.99" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Family plan: $9.99/month")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Start your family subscription for $1.99 for the first month, then $9.99/month. We use the initial parent payment as part of our COPPA parental consent workflow before child profiles and tutoring sessions can begin.")).toBeVisible({ timeout: 30000 });

  const checkoutResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/billing/checkout-session") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Start subscription for $1.99" }).click();

  const checkoutResponse = await checkoutResponsePromise;
  expect(checkoutResponse.status()).toBe(200);
  await expect(page).toHaveURL(/billing=checkout_success/, { timeout: 30000 });
});

test("first-time onboarding shows subscription CTA after parent verification and starts subscription checkout", async ({ page }) => {
  await mockParentWorkspaceApis(page, {
    parent: {
      id: "parent_1",
      email: "parent@example.test",
      full_name: "Parent",
      coppa_consent_required: true,
      coppa_consent_status: "granted",
      coppa_consent_method: "stripe_card_verification_charge",
      coppa_consent_updated_at: "2026-02-24T00:00:00.000Z",
      coppa_policy_version: "2026-02-19"
    },
    billing: {
      enabled: true,
      provider: "stripe",
      subscription: {
        provider: "stripe",
        status: "incomplete",
        has_access: false,
        provider_customer_id: "cus_123",
        provider_subscription_id: null,
        provider_price_id: "price_123",
        parent_verification_completed_at: "2026-02-24T00:00:00.000Z",
        parent_verification_amount_cents: 100,
        parent_verification_currency: "usd"
      }
    },
    checkoutUrl: "__same_origin_parent_success__"
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-trial-onboarding")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Complete subscription signup" })).toBeVisible({ timeout: 30000 });

  const checkoutResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/billing/checkout-session") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Complete subscription signup" }).click();
  const checkoutResponse = await checkoutResponsePromise;
  expect(checkoutResponse.status()).toBe(200);
  await expect(page).toHaveURL(/billing=checkout_success/, { timeout: 30000 });
});

test("canceled subscription returns parent to signup onboarding without revoking consent", async ({ page }) => {
  await mockParentWorkspaceApis(page, {
    parent: {
      id: "parent_1",
      email: "parent@example.test",
      full_name: "Parent",
      coppa_consent_required: true,
      coppa_consent_status: "granted",
      coppa_consent_method: "stripe_subscription_checkout_payment",
      coppa_consent_updated_at: "2026-02-24T00:00:00.000Z",
      coppa_policy_version: "2026-02-19"
    },
    billing: {
      enabled: true,
      provider: "stripe",
      subscription: {
        provider: "stripe",
        status: "canceled",
        has_access: false,
        provider_customer_id: "cus_123",
        provider_subscription_id: "sub_123",
        provider_price_id: "price_123",
        current_period_start_at: "2026-02-01T00:00:00.000Z",
        current_period_end_at: "2026-02-10T00:00:00.000Z",
        cancel_at_period_end: false,
        canceled_at: "2026-02-24T00:00:00.000Z",
        updated_at: "2026-02-24T00:00:00.000Z"
      }
    },
    checkoutUrl: "__same_origin_parent_success__"
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-trial-onboarding")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-section-link-managed")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Restart your subscription" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Start for $1.99 (first month)" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restart subscription" })).toBeVisible({ timeout: 30000 });

  const checkoutResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/billing/checkout-session") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Restart subscription" }).click();
  const checkoutResponse = await checkoutResponsePromise;
  expect(checkoutResponse.status()).toBe(200);
  await expect(page).toHaveURL(/billing=checkout_success/, { timeout: 30000 });
});

test("session controls disable start when billing is past_due", async ({ page }) => {
  await mockParentWorkspaceApis(page, {
    parent: {
      id: "parent_1",
      email: "parent@example.test",
      full_name: "Parent",
      coppa_consent_required: true,
      coppa_consent_status: "granted",
      coppa_consent_method: "stripe_card_verification_charge",
      coppa_policy_version: "2026-02-19",
      coppa_consent_updated_at: "2026-02-24T00:00:00.000Z"
    },
    children: [
      {
        id: "child_1",
        first_name: "Ava",
        age: 9,
        grade: "4",
        subjects: ["Math"],
        profile_notes: null,
        special_needs: null,
        created_at: "2026-02-24T00:00:00.000Z"
      }
    ],
    sessions: [],
    billing: {
      enabled: true,
      provider: "stripe",
      subscription: {
        provider: "stripe",
        status: "past_due",
        has_access: false,
        provider_customer_id: "cus_123",
        provider_subscription_id: "sub_123",
        provider_price_id: "price_123",
        trial_start_at: "2026-02-17T00:00:00.000Z",
        trial_end_at: "2026-02-24T00:00:00.000Z",
        current_period_start_at: "2026-02-24T00:00:00.000Z",
        current_period_end_at: "2026-03-24T00:00:00.000Z",
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: "2026-02-24T00:00:00.000Z"
      }
    }
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });

  await goToParentSection(page, "sessions");
  await page.getByTestId("child-session-card-child_1").click();
  await expect(page.getByRole("heading", { name: /Session for Ava/ })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Billing status is past due/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("session-start-submit")).toBeDisabled({ timeout: 30000 });
});

test("billing tab shows subscription details, trial warning, and opens billing portal", async ({ page }) => {
  const nowMs = Date.now();
  const trialStartAt = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const trialEndAt = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
  const currentPeriodStartAt = trialStartAt;
  const currentPeriodEndAt = new Date(nowMs + 29 * 24 * 60 * 60 * 1000).toISOString();

  await mockParentWorkspaceApis(page, {
    parent: {
      id: "parent_1",
      email: "parent@example.test",
      full_name: "Parent",
      coppa_consent_required: true,
      coppa_consent_status: "granted",
      coppa_consent_method: "stripe_card_verification_charge",
      coppa_policy_version: "2026-02-19",
      coppa_consent_updated_at: "2026-02-24T00:00:00.000Z"
    },
    billing: {
      enabled: true,
      provider: "stripe",
      subscription: {
        provider: "stripe",
        status: "trialing",
        has_access: true,
        provider_customer_id: "cus_123",
        provider_subscription_id: "sub_123",
        provider_price_id: "price_123",
        trial_start_at: trialStartAt,
        trial_end_at: trialEndAt,
        current_period_start_at: currentPeriodStartAt,
        current_period_end_at: currentPeriodEndAt,
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: "2026-02-24T00:00:00.000Z"
      }
    },
    portalUrl: "__same_origin_parent_portal_return__"
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });

  await goToParentSection(page, "billing");
  await expect(page.getByRole("heading", { name: "Subscription & consent", exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Subscription details", exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("billing-account-card")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Trial ends in 1 day|Trial ends in 2 days|Trial has ended/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("billing-active-until")).toContainText("Current period ends");

  const portalResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/billing/portal-session") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Manage billing" }).click();
  const portalResponse = await portalResponsePromise;
  expect(portalResponse.status()).toBe(200);
  await expect(page).toHaveURL(/billing=portal_return/, { timeout: 30000 });
});

test("billing tab shows cancel notice and active-until date when cancelation is scheduled", async ({ page }) => {
  await mockParentWorkspaceApis(page, {
    parent: {
      id: "parent_1",
      email: "parent@example.test",
      full_name: "Parent",
      coppa_consent_required: true,
      coppa_consent_status: "granted",
      coppa_consent_method: "stripe_subscription_checkout_payment",
      coppa_policy_version: "2026-02-19",
      coppa_consent_updated_at: "2026-02-24T00:00:00.000Z"
    },
    billing: {
      enabled: true,
      provider: "stripe",
      subscription: {
        provider: "stripe",
        status: "active",
        has_access: true,
        provider_customer_id: "cus_123",
        provider_subscription_id: "sub_123",
        provider_price_id: "price_123",
        current_period_start_at: "2026-02-24T00:00:00.000Z",
        current_period_end_at: "2026-03-24T00:00:00.000Z",
        cancel_at_period_end: true,
        canceled_at: "2026-02-24T00:00:00.000Z",
        updated_at: "2026-02-24T00:00:00.000Z"
      }
    }
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });

  await goToParentSection(page, "billing");
  await expect(page.getByText("Status: cancel scheduled")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("billing-cancel-notice")).toContainText("remains active until");
  await expect(page.getByTestId("billing-active-until")).toContainText("Active until");
});
