import {
  test as base,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    await page.context().setExtraHTTPHeaders({ Origin: origin });
    const response = await page.request.post("/api/auth/demo-login", {
      data: {},
      headers: { Origin: origin },
    });
    expect(response.ok()).toBeTruthy();
    const dashboard = await (await page.request.get("/api/dashboard")).json();
    if (BigInt(dashboard.locked ?? "0") > 0n) {
      const result = await page.request.post("/api/chat/messages", {
        data: { text: "運用分を全部TDに戻して" },
        headers: { Origin: origin },
      });
      expect(result.ok()).toBeTruthy();
    }
    await use(page);
  },
});
export { expect };
export async function demoApprove(page: Page) {
  const panel = page.getByRole("region", { name: "World承認" });
  await panel
    .getByRole("button", { name: "デモとして続ける", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "この内容をデモ承認", exact: true })
    .click();
  await expect(panel).not.toBeVisible();
}
export async function approveApi(
  request: APIRequestContext,
  input: object,
  origin: string,
) {
  const begun = await request.post("/api/demo/approvals", {
    data: { action: "begin", input },
    headers: { Origin: origin },
  });
  expect(begun.ok()).toBeTruthy();
  const { id } = await begun.json();
  const completed = await request.post("/api/demo/approvals", {
    data: { action: "confirm", id },
    headers: { Origin: origin },
  });
  expect(completed.ok()).toBeTruthy();
}
export async function openDemoActions(page: Page) {
  const actions = page.locator("details.agent-tools");
  const isOpen = await actions.evaluate(
    (element) => (element as HTMLDetailsElement).open,
  );
  if (!isOpen)
    await page.getByText("デモ操作とよく使う依頼", { exact: true }).click();
}
