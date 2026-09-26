import { test, expect, demoApprove } from "./helpers";

test("home uses three panes and guided demo route is removed", async ({
  page,
}) => {
  const removed = await page.goto("/demo");
  expect(removed?.status()).toBe(404);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "口座", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("口座A", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Agentチャット" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "送金予定", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("今後の支払い", { exact: true })).toHaveCount(0);
});
