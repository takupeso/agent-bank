import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("invest surplus after explicit consent and preserve inventory", async ({
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
  await openDemoActions(page);
  await page.getByRole("button", { name: "デモ：支払期日を迎える" }).click();
  await expect(
    page.getByText("アオバデザインへの¥200,000の支払いが完了しました。", {
      exact: true,
    }),
  ).toBeVisible();
  const data = await (await page.request.get("/api/dashboard")).json();
  expect(data.td).toBe("400000");
  expect(data.locked).toBe("400000");
  expect(data.positionUsdc).toBe("2500000000");
  expect(data.treasuryUsdc).toBe("7500000000");
  const orders = await (await page.request.get("/api/investments")).json();
  const replay = await page.request.post("/api/demo/events", {
    data: { type: "surplus_check", requestId: orders[0].runId },
  });
  expect(replay.ok()).toBeTruthy();
  const after = await (await page.request.get("/api/dashboard")).json();
  expect(after.positionUsdc).toBe(data.positionUsdc);
  expect(after.locked).toBe(data.locked);
  expect(after.treasuryUsdc).toBe(data.treasuryUsdc);
  await page.goto("/investment");
  await expect(page.getByText("2,500 USDC", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/td-bank-invest.png", fullPage: true });
});
