import { test, expect, demoApprove, openDemoActions } from "./helpers";
import { test as unauthenticated } from "@playwright/test";

unauthenticated(
  "explicit demo login hides private UI until selected and logout removes it",
  async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Agent Bankにログイン" }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Agentチャット" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "/private/tmp/td-auth-login.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "デモとして続ける" }).click();
    await expect(
      page.getByRole("heading", { name: "口座", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: sessionStorage.length,
        cookie: document.cookie,
      })),
    ).toEqual({ local: 0, session: 0, cookie: "" });
    const cookie = (await page.context().cookies()).find(
      (c) => c.name === "bank_session",
    );
    expect(cookie?.httpOnly).toBe(true);
    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(
      page.getByRole("heading", { name: "Agent Bankにログイン" }),
    ).toBeVisible();
  },
);

test("World unavailable permits explicit scoped demo consent; OK alone changes nothing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /デモを(初期化|リセット)/ }).click();
  await expect(page.getByText("¥1,000,000", { exact: true })).toBeVisible();
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "サンプルメールの閲覧を許可して確認",
      exact: true,
    })
    .click();
  const mail = page.getByRole("region", { name: "メール閲覧の確認" });
  const proposal = page.getByText("自動支払いの設定案");
  await Promise.race([mail.waitFor(), proposal.waitFor()]);
  if (await mail.isVisible()) {
    await expect(
      mail.getByText(
        /閲覧範囲：アオバデザインのサンプルメール・サクラオフィスのサンプルメール/,
      ),
    ).toBeVisible();
    await expect(mail.getByText(/対象Agent：bank-agent/)).toBeVisible();
    await mail.getByRole("button", { name: "この内容で許可して確認" }).click();
  }
  await expect(proposal).toBeVisible();
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "そうしてください（支払い設定）",
      exact: true,
    })
    .click();
  expect(await (await page.request.get("/api/rules")).json()).toEqual([]);
  const panel = page.getByRole("region", { name: "World承認" });
  const begun = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/demo/approvals") &&
      response.request().postDataJSON().action === "begin",
  );
  await panel.getByRole("button", { name: "デモとして続ける" }).click();
  const cancelledChallenge = await (await begun).json();
  await expect(
    panel.getByText("支払先：アオバデザイン・サクラオフィス"),
  ).toBeVisible();
  await expect(panel.getByText(/余力の自動運用/)).toBeVisible();
  await panel.getByRole("button", { name: "キャンセル" }).click();
  const replay = await page.request.post("/api/demo/approvals", {
    data: { action: "confirm", id: cancelledChallenge.id },
  });
  expect(replay.status()).toBe(409);
  expect(await (await page.request.get("/api/rules")).json()).toEqual([]);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "そうしてください（支払い設定）",
      exact: true,
    })
    .click();
  await demoApprove(page);
  await expect(page.getByText(/承認方法：デモ承認（World省略）/)).toHaveCount(
    2,
  );
  await page.goto("/rules");
  await page.getByRole("button", { name: "許可を取り消す" }).first().click();
  await expect(page.getByText(/取消済み/)).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/td-auth-permissions.png",
    fullPage: true,
  });
});

test("session invalidation hides loaded banking data", async ({
  page,
  baseURL,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "口座", exact: true }),
  ).toBeVisible();
  await page.request.post("/api/auth/logout", {
    data: {},
    headers: { Origin: baseURL! },
  });
  await page.getByRole("link", { name: "自動実行ルール", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Agent Bankにログイン" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Agentチャット" }),
  ).toHaveCount(0);
});

unauthenticated(
  "world mode presentation offers no demo continuation",
  async ({ page }) => {
    await page.route("**/api/auth/session", (r) =>
      r.fulfill({ json: { authenticated: false, authMode: "world" } }),
    );
    await page.route("**/api/world", (r) =>
      r.fulfill({
        json: {
          authMode: "world",
          required: true,
          enrolled: false,
          configured: false,
        },
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Agent Bankにログイン" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "デモとして続ける" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Worldが未設定です。通常モードではWorldの設定が必要です。",
      ),
    ).toBeVisible();
  },
);

test("World begin failure still offers explicit demo approval", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /デモを(初期化|リセット)/ }).click();
  await expect(page.getByText("¥1,000,000", { exact: true })).toBeVisible();
  await page.route("**/api/world", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({
        json: {
          authMode: "local-demo",
          required: false,
          enrolled: true,
          configured: true,
          mode: "live",
        },
      });
    else
      await route.fulfill({
        status: 503,
        json: { error: "Verifier unavailable" },
      });
  });
  await openDemoActions(page);
  await openDemoActions(page);
  await page
    .getByRole("button", {
      name: "サンプルメールの閲覧を許可して確認",
      exact: true,
    })
    .click();
  const mail = page.getByRole("region", { name: "メール閲覧の確認" });
  const proposal = page.getByText("自動支払いの設定案");
  await Promise.race([mail.waitFor(), proposal.waitFor()]);
  if (await mail.isVisible())
    await mail.getByRole("button", { name: "この内容で許可して確認" }).click();
  await expect(page.getByText("自動支払いの設定案")).toBeVisible();
  await openDemoActions(page);
  await page
    .getByRole("button", { name: "そうしてください（支払い設定）" })
    .click();
  const panel = page.getByRole("region", { name: "World承認" });
  await expect(panel.getByRole("alert")).toBeVisible();
  await panel.getByRole("button", { name: "デモとして続ける" }).click();
  await expect(panel.getByText(/対象Agent：bank-agent/)).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/td-auth-approval.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: "この内容をデモ承認" }).click();
  await expect(page.getByText("承認時の設定", { exact: true })).toHaveCount(2);
});
