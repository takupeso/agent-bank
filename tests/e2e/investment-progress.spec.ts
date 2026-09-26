import { test, expect } from "@playwright/test";
test("account balances and confirmed history follow deposit, token, Aave without reload", async ({
  page,
}) => {
  let phase = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({ json: { authenticated: true } });
    if (path === "/api/world")
      return route.fulfill({ json: { authMode: "local-demo" } });
    if (path === "/api/chat/messages") return route.fulfill({ json: [] });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: {
          initialized: true,
          mode: "sepolia",
          td: phase ? "400000" : "800000",
          looseUsdc: phase === 2 ? "2500000000" : "0",
          positionUsdc: phase === 3 ? "2500000300" : "0",
          investmentProgress: {
            runId: "run",
            status: phase === 3 ? "completed" : "running",
            completedStages: phase,
          },
          movements: [
            ...(phase >= 1
              ? [
                  {
                    id: "lock",
                    account: "deposit",
                    direction: "out",
                    amount: "400000",
                    unit: "JPY",
                    label: "運用分のTDを確保",
                  },
                ]
              : []),
            ...(phase >= 2
              ? [
                  {
                    id: "receive",
                    account: "token",
                    direction: "in",
                    amount: "2500000000",
                    unit: "USDC",
                    label: "銀行からUSDC受取",
                  },
                ]
              : []),
            ...(phase >= 3
              ? [
                  {
                    id: "deposit",
                    account: "token",
                    direction: "out",
                    amount: "2500000000",
                    unit: "USDC",
                    label: "Aaveへ預入",
                  },
                  {
                    id: "supply",
                    account: "aave",
                    direction: "in",
                    amount: "2500000000",
                    unit: "USDC",
                    label: "Aaveへ預入",
                  },
                ]
              : []),
          ],
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const account = (name: string) =>
    page
      .locator(".account-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  const balance = (name: string) =>
    account(name).locator(".account-card-header strong");
  await expect(balance("預金口座")).toHaveText("¥800,000");
  await expect(page.getByText("TDを確保中", { exact: true })).toBeVisible();
  phase = 1;
  await expect(balance("預金口座")).toHaveText("¥400,000");
  await expect(account("預金口座").getByText("運用分のTDを確保")).toBeVisible();
  await expect(balance("トークン口座")).toHaveText("0 USDC");
  phase = 2;
  await expect(balance("トークン口座")).toHaveText("2,500 USDC");
  await expect(
    account("トークン口座").getByText("銀行からUSDC受取"),
  ).toBeVisible();
  await expect(balance("Aave")).toHaveText("0 USDC");
  await expect(
    page.getByText("Aave預入の確定待ち", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/td-investment-token-stage.png",
    fullPage: true,
  });
  phase = 3;
  await expect(balance("トークン口座")).toHaveText("0 USDC");
  await expect(balance("Aave")).toHaveText("2,500 USDC");
  await expect(account("Aave").getByText("Aaveへ預入")).toBeVisible();
  await expect(
    page.getByText("Aaveへの預入が完了しました。", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/td-investment-completed-stage.png",
    fullPage: true,
  });
});
