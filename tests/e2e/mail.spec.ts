import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";

test("mail evidence is visible before consent and invoices wait for consent", async ({
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
  await page.getByText("元メールを表示", { exact: true }).first().click();
  await expect(
    page.getByText(
      "9月分の業務委託費20万円の請求書をお送りします。9月22日12時までのお支払いをお願いいたします。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("自動支払いの設定案", { exact: true }),
  ).toBeVisible();
  await page.goto("/invoices");
  await expect(
    page.getByText(
      "支払い条件に同意すると、対象の請求書がここに表示されます。",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/td-bank-mail.png", fullPage: true });
});
