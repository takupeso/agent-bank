import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("chat consent persists a versioned rule then change and stop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /デモを(初期化|リセット)/ }).click();
  await expect(page.getByText("¥1,000,000", { exact: true })).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "サンプルメールの閲覧を許可して確認",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await expect(
    page.getByText("自動支払いの設定案", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "そうしてください（支払い設定）",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await expect(page.getByText("承認時の設定", { exact: true })).toBeVisible();
  await page.goto("/rules");
  await expect(page.getByLabel("月合計の支払上限（円）").first()).toHaveValue(
    "200000",
  );
  await page.getByLabel("月合計の支払上限（円）").first().fill("300000");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await demoApprove(page);
  await expect(page.getByText("有効 · 第2版")).toBeVisible();
  await page.getByRole("button", { name: "停止する" }).click();
  await expect(page.getByText("停止中 · 第3版")).toBeVisible();
  await page.getByRole("button", { name: "有効にする" }).click();
  await demoApprove(page);
  await expect(page.getByText("有効 · 第4版")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("月合計の支払上限（円）").first()).toHaveValue(
    "300000",
  );
  await page.screenshot({ path: "/tmp/td-bank-rules.png", fullPage: true });
});
