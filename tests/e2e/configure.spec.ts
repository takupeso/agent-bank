import { sendChat } from "./helpers";
import { test, expect, demoApprove } from "./helpers";
test("chat consent persists a versioned rule then change and stop", async ({
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
  await expect(
    page.getByText("Automatic payment proposal", { exact: true }),
  ).toBeVisible();

  await sendChat(page, "Confirm these settings");
  const approval = page.getByRole("region", { name: "World approval" });
  await approval
    .getByRole("button", { name: "Continue as demo", exact: true })
    .click();
  await expect(
    approval.getByRole("heading", { name: "Payees and payment limits" }),
  ).toBeVisible();
  await expect(
    approval.getByRole("heading", { name: "Investment destination and limit" }),
  ).toBeVisible();
  await expect(approval).toContainText("Harp Branch");
  await page.screenshot({
    path: "/tmp/agent-bank-combined-approval.png",
    fullPage: true,
  });
  await approval
    .getByRole("button", { name: "Approve these terms in demo", exact: true })
    .click();
  await expect(approval).not.toBeVisible();
  await expect(page.getByText("Approval", { exact: true })).toHaveCount(2);
  const initial = await (await page.request.get("/api/rules")).json();
  expect(initial).toHaveLength(2);
  expect(
    initial.find((rule: { id: string }) => rule.id === "investment")
      .investmentTarget,
  ).toMatchObject({ mode: "stub" });
  expect(initial[0].authorization.approvalId).toBe(
    initial[1].authorization.approvalId,
  );
  await page.goto("/rules");
  await page.getByRole("tab", { name: "Deposit operations" }).click();
  await page.getByText("Edit settings", { exact: true }).click();
  const payment = page
    .locator("section.panel")
    .filter({ has: page.getByRole("heading", { name: /Automatic payments/ }) });
  await expect(
    page.getByLabel("Monthly payment limit (JPY)").first(),
  ).toHaveValue("200000");
  await page.getByLabel("Monthly payment limit (JPY)").first().fill("300000");
  await payment.getByRole("button", { name: "Save changes" }).click();
  await demoApprove(page);
  await expect(payment.getByText("Active · Version 2")).toBeVisible();
  await payment.getByRole("button", { name: "Pause" }).click();
  await expect(payment.getByText("Paused · Version 3")).toBeVisible();
  await payment.getByRole("button", { name: "Enable" }).click();
  await demoApprove(page);
  await expect(payment.getByText("Active · Version 4")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Deposit operations" }).click();
  await page.getByText("Edit settings", { exact: true }).click();
  await expect(
    page.getByLabel("Monthly payment limit (JPY)").first(),
  ).toHaveValue("300000");
  await page.screenshot({ path: "/tmp/td-bank-rules.png", fullPage: true });
});
