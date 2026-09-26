import { runDemoEvent, sendChat } from "./helpers";
import { test, expect, demoApprove } from "./helpers";
test("stopped payment rule applies to unexecuted invoice and can resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /(Initialize|Reset) demo/ }).click();
  await expect(
    page.locator("main").getByText("¥1,000,000", { exact: true }),
  ).toBeVisible();
  await page.goto("/chat");

  await sendChat(
    page,
    "I allow access to my emails. Please check the invoices.",
  );
  await demoApprove(page);

  await sendChat(page, "Confirm these settings");
  await demoApprove(page);
  await expect(page.getByText("Approval", { exact: true })).toHaveCount(2);
  await page.goto("/rules");
  await page.getByRole("tab", { name: "Deposit operations" }).click();
  await page.getByRole("button", { name: "Pause" }).first().click();
  await expect(page.getByText("Paused · Version 2")).toBeVisible();
  await page.goto("/chat");

  await runDemoEvent(page, "due_date_reached", false);

  expect((await (await page.request.get("/api/dashboard")).json()).td).toBe(
    "600000",
  );
  await page.goto("/rules");
  await page.getByRole("tab", { name: "Deposit operations" }).click();
  await page.getByRole("button", { name: "Enable" }).first().click();
  await demoApprove(page);
  await expect(page.getByText("Active · Version 3")).toBeVisible();
  await page.goto("/chat");

  await runDemoEvent(page, "due_date_reached");
  await expect(page.getByText("Paid ¥200,000 to Aoba Design.")).toBeVisible();
});
