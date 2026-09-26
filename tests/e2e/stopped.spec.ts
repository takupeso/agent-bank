import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("stopped payment rule applies to unexecuted invoice and can resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /(Initialize|Reset) demo/ }).click();
  await expect(page.locator("main").getByText("¥1,000,000", { exact: true })).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "I allow access to my emails. Please check the invoices.",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "Confirm payment setup",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await expect(page.getByText("Approval", { exact: true })).toHaveCount(2);
  await page.goto("/rules");
  await page.getByRole("tab", { name: "Deposit operations" }).click();
  await page.getByRole("button", { name: "Pause" }).first().click();
  await expect(page.getByText("Paused · Version 2")).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", { name: "Demo: advance to payment due date" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Demo: advance to payment due date",
      includeHidden: true,
    }),
  ).toBeEnabled();
  expect((await (await page.request.get("/api/dashboard")).json()).td).toBe(
    "600000",
  );
  await page.goto("/rules");
  await page.getByRole("tab", { name: "Deposit operations" }).click();
  await page.getByRole("button", { name: "Enable" }).first().click();
  await demoApprove(page);
  await expect(page.getByText("Active · Version 3")).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", { name: "Demo: advance to payment due date" })
    .click();
  await expect(page.getByText("Paid ¥200,000 to Aoba Design.")).toBeVisible();
});
