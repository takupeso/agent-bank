import { test, expect, demoApprove } from "./helpers";
test("initialization and reset show confirmed local TD", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /デモを(初期化|リセット)/ }).click();
  await expect(page.getByText("¥1,000,000", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  const first = await (await page.request.get("/api/dashboard")).json();
  await page.getByRole("button", { name: "デモをリセット" }).click();
  await expect(
    page.getByRole("button", { name: "デモをリセット" }),
  ).toBeEnabled({ timeout: 60000 });
  const second = await (await page.request.get("/api/dashboard")).json();
  expect(second.id).not.toBe(first.id);
  expect(second.token).not.toBe(first.token);
  expect(second.td).toBe("1000000");
  expect(second.locked).toBe("0");
  expect(second.recipientTd).toBe("0");
  await page.screenshot({
    path: "/tmp/td-bank-initialize.png",
    fullPage: true,
  });
});
