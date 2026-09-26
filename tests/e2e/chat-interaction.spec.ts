import { test, expect } from "@playwright/test";
test("quick requests close tools and new chat content scrolls into view", async ({
  page,
}) => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    role: "assistant",
    text: `以前の会話 ${index}。口座の処理について確認しています。`,
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({ json: { authenticated: true } });
    if (path === "/api/world")
      return route.fulfill({ json: { authMode: "local-demo" } });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: { initialized: true, td: "800000", movements: [] },
      });
    if (path === "/api/chat/messages") {
      if (route.request().method() === "POST")
        messages.push({
          id: "new",
          role: "assistant",
          text: "今回の運用案を作成しました。",
        });
      return route.fulfill({ json: messages });
    }
    if (path === "/api/demo/events")
      return route.fulfill({ status: 400, json: { error: "failed" } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const conversation = page.locator(".agent-conversation");
  await expect(
    page.getByText("以前の会話 29。口座の処理について確認しています。", {
      exact: true,
    }),
  ).toBeInViewport();
  await conversation.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByText("デモ操作とよく使う依頼", { exact: true }).click();
  await page
    .getByRole("button", { name: "余力を運用したい", exact: true })
    .click();
  await expect(page.locator("details.agent-tools")).not.toHaveAttribute("open");
  await expect(
    page.getByText("今回の運用案を作成しました。", { exact: true }),
  ).toBeInViewport();
  await expect
    .poll(() =>
      conversation.evaluate(
        (element) =>
          element.scrollHeight - element.clientHeight - element.scrollTop,
      ),
    )
    .toBeLessThan(5);
  await page.getByText("デモ操作とよく使う依頼", { exact: true }).click();
  await page
    .getByRole("button", { name: "デモ：支払期日を迎える", exact: true })
    .click();
  await expect(page.locator("details.agent-tools")).not.toHaveAttribute("open");
  await expect(page.locator(".agent-error")).toContainText(
    "処理を完了できませんでした",
  );
});
