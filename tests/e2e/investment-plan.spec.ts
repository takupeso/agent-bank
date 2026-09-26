import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`investment plan groups reserves and separates invested assets at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/session")
        return route.fulfill({ json: { authenticated: true } });
      if (path === "/api/world")
        return route.fulfill({ json: { authMode: "local-demo" } });
      if (path === "/api/chat/messages") return route.fulfill({ json: [] });
      if (path === "/api/cashflow")
        return route.fulfill({
          json: {
            td: "800000",
            confirmedJpy: "100000",
            predictedJpy: "200000",
            bufferJpy: "100000",
            reserveJpy: "400000",
            investJpy: "400000",
          },
        });
      if (path === "/api/dashboard")
        return route.fulfill({
          json: {
            initialized: true,
            mode: "sepolia",
            positionUsdc: "2500000000",
          },
        });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto("/investment");
    await expect(
      page.getByRole("heading", { name: "Investment plan", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Investment plan", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Deposit balance", exact: true }),
    ).toContainText("¥800,000");
    const reserve = page.getByRole("region", {
      name: "Reserved funds",
      exact: true,
    });
    await expect(reserve).toContainText("¥400,000");
    await expect(
      reserve.getByRole("heading", { name: "Breakdown through month-end" }),
    ).toBeVisible();
    await expect(reserve).toContainText("Forecast from history (Minato Cloud)");
    const assets = page.getByRole("region", {
      name: "Investment assets",
      exact: true,
    });
    await expect(
      assets.getByRole("region", { name: "Invested", exact: true }),
    ).toContainText("2,500 USDC");
    await expect(
      assets.getByRole("region", { name: "Available to invest", exact: true }),
    ).toContainText("¥400,000");
    await expect(
      page.getByText(
        /Corresponding TD lock|Principal|1 USDC = 160|Base Sepolia · Aave/,
      ),
    ).toHaveCount(0);
    expect(
      await page
        .locator("main")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/agent-bank-investment-plan-${width}.png`,
      fullPage: true,
    });
  });
}
