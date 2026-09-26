import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("due date pays once with receipt and current monthly usage", async ({
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
  await expect(
    page.getByText("自動支払いの設定案", { exact: true }),
  ).toBeVisible();
  await page.getByText("元メールを表示", { exact: true }).first().click();
  await expect(
    page.getByText(
      "9月分の業務委託費20万円の請求書をお送りします。9月22日12時までのお支払いをお願いいたします。",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/invoices");
  await expect(
    page.getByText(
      "支払い条件に同意すると、対象の請求書がここに表示されます。",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "そうしてください（支払い設定）",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await expect(page.getByText("承認時の設定", { exact: true })).toHaveCount(2);
  await page.goto("/invoices");
  await expect(
    page.getByRole("heading", { name: "サクラオフィス", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("支払い予定", { exact: true })).toHaveCount(2);
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page.getByRole("button", { name: "デモ：支払期日を迎える" }).click();
  await expect(
    page.getByText("アオバデザインへの¥200,000の支払いが完了しました。", {
      exact: true,
    }),
  ).toBeVisible();
  const first = await (await page.request.get("/api/dashboard")).json();
  expect(first.td).toBe("400000");
  expect(first.recipientTd).toBe("200000");
  await openDemoActions(page);
  await page.getByRole("button", { name: "デモ：支払期日を迎える" }).click();
  await expect(
    page.getByRole("button", {
      name: "デモ：支払期日を迎える",
      includeHidden: true,
    }),
  ).toBeEnabled();
  const second = await (await page.request.get("/api/dashboard")).json();
  expect(second.td).toBe("400000");
  await page.screenshot({ path: "/tmp/td-bank-pay.png", fullPage: true });
});
