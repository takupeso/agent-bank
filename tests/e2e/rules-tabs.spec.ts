import { test, expect } from "@playwright/test";
const baseRule = {
  version: 1,
  enabled: true,
  status: "active",
  recipientId: "aoba",
  maxPaymentJpy: "200000",
  monthlyLimitJpy: "200000",
  safetyBufferJpy: "100000",
  maxInvestmentJpy: "400000",
  minimumBalanceJpy: "0",
  payAt: "dueDate",
  consentId: "test",
};
for (const width of [1440, 390]) {
  test(`rules expose scoped access and approved limits in tabs at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const grants = [
      {
        id: "mail",
        status: "active",
        mailIds: ["aoba-mail"],
        authorization: {
          scopes: ["mail", "read", "propose"],
          agentId: "bank-agent",
        },
      },
      {
        id: "pay",
        status: "active",
        mailIds: [],
        authorization: { scopes: ["payment"], agentId: "bank-agent" },
      },
      {
        id: "invest",
        status: "active",
        mailIds: [],
        authorization: {
          scopes: ["investment", "redemption"],
          agentId: "bank-agent",
        },
      },
    ];
    const investment = {
      ...baseRule,
      id: "investment",
      investmentTarget: {
        protocol: "Aave V3",
        mode: "sepolia",
        chainId: 84532,
      },
    };
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/session")
        return route.fulfill({ json: { authenticated: true } });
      if (path === "/api/world")
        return route.fulfill({
          json: { authMode: "local-demo", configured: false },
        });
      if (path === "/api/rules")
        return route.fulfill({
          json: [
            {
              ...baseRule,
              id: "payment",
              investmentTarget: null,
              paymentRecipients: [
                {
                  recipientId: "aoba",
                  maxPaymentJpy: "200000",
                  monthlyLimitJpy: "200000",
                },
              ],
            },
            investment,
          ],
        });
      if (path === "/api/delegations") return route.fulfill({ json: grants });
      if (path === "/api/delegations/mail/revoke") {
        grants[0].status = "revoked";
        return route.fulfill({ json: {} });
      }
      if (path === "/api/chat/messages")
        return route.fulfill({
          json: [
            {
              id: "proposal",
              role: "assistant",
              kind: "proposal",
              text: "Investment proposal.",
              data: {
                proposal: {
                  id: "proposal",
                  kind: "investment",
                  conditions: investment,
                },
                snapshot: {
                  td: "800000",
                  confirmedJpy: "100000",
                  predictedJpy: "200000",
                  bufferJpy: "100000",
                  reserveJpy: "400000",
                  investJpy: "400000",
                },
              },
            },
          ],
        });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto("/rules");
    const panel = () => page.getByRole("tabpanel");
    await expect(
      page.getByRole("tab", { name: "Data access" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(panel()).toContainText("Aoba Design emails and invoices");
    await expect(panel()).not.toContainText("Sakura Office");
    await expect(panel()).toContainText("Deposit balance and automation rules");
    await page.screenshot({
      path: `/tmp/agent-bank-rules-data-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Data access" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Deposit operations" }),
    ).toBeFocused();
    await expect(panel().locator(".approved-rule-summary")).toContainText(
      "¥200,000",
    );
    await expect(panel()).not.toContainText("Aave");
    await panel().getByText("Edit settings", { exact: true }).click();
    await panel()
      .getByLabel("Payment limit per transaction (JPY)")
      .fill("300000");
    await expect(panel().locator(".approved-rule-summary")).not.toContainText(
      "¥300,000",
    );
    await expect(panel().locator(".approved-rule-summary")).toContainText(
      "¥200,000",
    );
    await panel().getByText("Edit settings", { exact: true }).click();
    await page.screenshot({
      path: `/tmp/agent-bank-rules-payment-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Token operations" }).click();
    await expect(panel()).toContainText("Aave V3");
    await expect(panel()).toContainText("Base Sepolia");
    await expect(panel().locator(".approved-rule-summary")).toContainText(
      "¥400,000",
    );
    await expect(panel()).not.toContainText("Aoba Design");
    await page.screenshot({
      path: `/tmp/agent-bank-rules-token-${width}.png`,
      fullPage: true,
    });
    const proposal = page.locator(".message .card");
    await expect(proposal).toContainText("Investment proposal");
    await expect(proposal).toContainText("Current deposit");
    await expect(proposal).toContainText("Funds to keep");
    await expect(proposal).toContainText("Available for this investment");
    await expect(proposal).not.toContainText("Reserved amount");
    await page.getByRole("tab", { name: "Data access" }).click();
    await panel().getByRole("button", { name: "Revoke permission" }).click();
    await expect(panel()).toContainText("Revoked");
    await expect(
      panel().getByRole("button", { name: "Revoke permission" }),
    ).toBeDisabled();
    expect(
      await page
        .locator("main")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  });
}
