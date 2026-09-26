import { test, expect, demoApprove } from "./helpers";
import { openDemoActions } from "./helpers";
test("redeem all investment through chat and restore original TD", async ({
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
  await openDemoActions(page);
  await page
    .getByRole("button", { name: "運用分を全部TDに戻して", exact: true })
    .click();
  await expect(
    page.getByText("運用分を償還し、¥400,000をTD預金へ戻しました。"),
  ).toBeVisible();
  const restored = await (await page.request.get("/api/dashboard")).json();
  expect(restored.td).toBe("800000");
  expect(restored.recipientTd).toBe("200000");
  expect(restored.locked).toBe("0");
  expect(restored.positionUsdc).toBe("0");
  expect(restored.treasuryUsdc).toBe("10000000000");
  await page.goto("/");
  await expect(page.getByText("¥800,000", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/td-bank-redeem.png", fullPage: true });
});

test("redeem multiple positions even after investment rule is stopped", async ({
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
  await openDemoActions(page);
  await page
    .getByRole("button", { name: "運用分を全部TDに戻して", exact: true })
    .click();
  await expect(
    page.getByText("運用分を償還し、¥400,000をTD預金へ戻しました。"),
  ).toBeVisible();
  await page.goto("/rules");
  await page.getByLabel("1回の運用上限（円）").fill("200000");
  await page.getByRole("button", { name: "変更を保存" }).last().click();
  await demoApprove(page);
  await page.goto("/chat");
  await openDemoActions(page);
  await expect(
    page.getByText(
      "¥200,000を別段口座にlockし、1,250擬似USDC相当を模擬運用しました。",
    ),
  ).toBeVisible();
  await openDemoActions(page);
  await page.getByRole("button", { name: "デモ：余力をチェック" }).click();
  await expect(
    page.getByText(
      "¥200,000を別段口座にlockし、1,250擬似USDC相当を模擬運用しました。",
    ),
  ).toHaveCount(2);
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
  await page.goto("/rules");
  await page.getByRole("button", { name: "停止する" }).last().click();
  await expect(page.getByText("停止中 · 第3版")).toBeVisible();
  await page.goto("/chat");
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", { name: "運用分を全部TDに戻して", exact: true })
    .click();
  await expect(
    page.getByText("運用分を償還し、¥400,000をTD預金へ戻しました。"),
  ).toHaveCount(2);
  const restored = await (await page.request.get("/api/dashboard")).json();
  expect(restored.td).toBe("800000");
  expect(restored.recipientTd).toBe("200000");
  expect(restored.locked).toBe("0");
  expect(restored.positionUsdc).toBe("0");
  expect(restored.treasuryUsdc).toBe("10000000000");
  await page.goto("/");
  await expect(page.getByText("¥800,000", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/td-bank-redeem.png", fullPage: true });
});
