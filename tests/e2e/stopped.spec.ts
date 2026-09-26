import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("stopped payment rule applies to unexecuted invoice and can resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /デモを(初期化|リセット)/ }).click();
  await expect(page.getByText("¥1,000,000", { exact: true })).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "サンプルメールの閲覧を許可して確認",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "そうしてください（支払い設定）",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await expect(page.getByText("承認時の設定", { exact: true })).toHaveCount(2);
  await page.goto("/rules");
  await page.getByRole("button", { name: "停止する" }).first().click();
  await expect(page.getByText("停止中 · 第2版")).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page.getByRole("button", { name: "デモ：支払期日を迎える" }).click();
  await expect(
    page.getByRole("button", {
      name: "デモ：支払期日を迎える",
      includeHidden: true,
    }),
  ).toBeEnabled();
  expect((await (await page.request.get("/api/dashboard")).json()).td).toBe(
    "600000",
  );
  await page.goto("/rules");
  await page.getByRole("button", { name: "有効にする" }).first().click();
  await demoApprove(page);
  await expect(page.getByText("有効 · 第3版")).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page.getByRole("button", { name: "デモ：支払期日を迎える" }).click();
  await expect(
    page.getByText("アオバデザインへの¥200,000の支払いが完了しました。"),
  ).toBeVisible();
});
