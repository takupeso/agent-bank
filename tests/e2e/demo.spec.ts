import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("replay complete demo twice and inspect all five screens", async ({
  page,
}) => {
  for (let cycle = 0; cycle < 2; cycle++) {
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
    await expect(page.getByText("承認時の設定", { exact: true })).toBeVisible();
    await openDemoActions(page);
    await page.getByRole("button", { name: "デモ：支払期日を迎える" }).click();
    await expect(
      page.getByText("アオバデザインへの¥200,000の支払いが完了しました。"),
    ).toBeVisible();
    await page.goto("/invoices");
    await expect(page.getByText("支払済み", { exact: true })).toBeVisible();
    await page.getByText("元メールを表示").first().click();
    await page.screenshot({
      path: `/tmp/td-demo-invoices-${cycle}.png`,
      fullPage: true,
    });
    await page.goto("/chat");
    await openDemoActions(page);
    await openDemoActions(page);
    await page
      .getByRole("button", { name: "余力を運用したい", exact: true })
      .click();
    await openDemoActions(page);
    await page
      .getByRole("button", {
        name: "そうしてください（運用設定）",
        exact: true,
      })
      .click();
    await demoApprove(page);
    await expect(
      page.getByText(
        "余力の自動運用を設定しました。承認条件を再確認して運用を開始します。",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "¥400,000を別段口座にlockし、2,500擬似USDC相当を模擬運用しました。",
      ),
    ).toBeVisible();
    await page.goto("/investment");
    await expect(page.getByText("2,500 USDC", { exact: true })).toBeVisible();
    await page.screenshot({
      path: `/tmp/td-demo-investment-${cycle}.png`,
      fullPage: true,
    });
    await page.goto("/rules");
    await expect(page.getByLabel("1回の運用上限（円）")).toHaveValue("400000");
    await page.screenshot({
      path: `/tmp/td-demo-rules-${cycle}.png`,
      fullPage: true,
    });
    await page.goto("/chat");
    await openDemoActions(page);
    await openDemoActions(page);
    await page
      .getByRole("button", { name: "運用分を全部TDに戻して", exact: true })
      .click();
    await expect(
      page.getByText("運用分を償還し、¥400,000をTD預金へ戻しました。"),
    ).toBeVisible();
    const result = await (await page.request.get("/api/dashboard")).json();
    expect(result.td).toBe("800000");
    expect(result.recipientTd).toBe("200000");
    expect(result.locked).toBe("0");
    expect(result.positionUsdc).toBe("0");
    expect(result.treasuryUsdc).toBe("10000000000");
    await page.getByText("実行詳細", { exact: true }).last().click();
    await expect(
      page.getByText("元の顧客口座へTDを解除 · Anvil確定"),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/td-demo-chat-${cycle}.png`,
      fullPage: true,
    });
    await page.goto("/");
    await expect(page.getByText("¥800,000", { exact: true })).toBeVisible();
    await page.screenshot({
      path: `/tmp/td-demo-home-${cycle}.png`,
      fullPage: true,
    });
  }
});
