import { test, expect } from "@playwright/test";

for (const chatFails of [false, true]) {
  test(`due-date completion refreshes balances and movements (chat failure: ${chatFails})`, async ({
    page,
  }) => {
    let paid = false;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/session")
        return route.fulfill({ json: { authenticated: true } });
      if (path === "/api/world")
        return route.fulfill({ json: { authMode: "local-demo" } });
      if (path === "/api/dashboard")
        return route.fulfill({
          json: {
            initialized: true,
            mode: "stub",
            td: paid ? "800000" : "1000000",
            looseUsdc: "0",
            positionUsdc: "0",
            movements: paid
              ? [
                  {
                    id: "payment",
                    account: "deposit",
                    direction: "out",
                    amount: "200000",
                    unit: "JPY",
                    label: "Invoice payment",
                  },
                ]
              : [],
          },
        });
      if (path === "/api/demo/events") {
        expect(route.request().postDataJSON().type).toBe("due_date_reached");
        paid = true;
        return route.fulfill({
          json: { id: "run", kind: "payment", status: "completed", steps: [] },
        });
      }
      if (path === "/api/chat/messages")
        return route.fulfill({
          status: paid && chatFails ? 500 : 200,
          json: [],
        });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto("/");
    const deposit = page.locator(".account-card").filter({
      has: page.getByRole("heading", { name: "Deposit account", exact: true }),
    });
    await expect(deposit.locator(".account-card-header strong")).toHaveText(
      "¥1,000,000",
    );
    await page
      .getByText("Demo actions and common requests", { exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Demo: advance to payment due date",
        exact: true,
      })
      .click();
    await expect(deposit.locator(".account-card-header strong")).toHaveText(
      "¥800,000",
    );
    await expect(
      deposit.getByText("Invoice payment", { exact: true }),
    ).toBeVisible();
    await expect(deposit.getByText("−¥200,000", { exact: true })).toBeVisible();
  });
}

test("reset explains outstanding assets without starting redemption", async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") calls.push(path);
    if (path === "/api/auth/session")
      return route.fulfill({ json: { authenticated: true } });
    if (path === "/api/world")
      return route.fulfill({ json: { authMode: "local-demo" } });
    if (path === "/api/chat/messages") return route.fulfill({ json: [] });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: {
          initialized: true,
          td: "400000",
          positionUsdc: "2500000000",
          movements: [],
        },
      });
    if (path === "/api/demo/reset")
      return route.fulfill({
        status: 409,
        json: {
          code: "OUTSTANDING_ASSETS",
          error:
            "Cannot reset while funds are invested. Send 'Redeem all investments to TD' in chat.",
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Redeem all investments to TD",
  );
  expect(calls).toEqual(["/api/demo/reset"]);
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
});
