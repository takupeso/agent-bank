import { test, expect, demoApprove } from "./helpers";
test("public wallet survives reset and is shown without secrets", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /(Initialize|Reset) demo/ }).click();
  await expect(page.locator("main").getByText("¥1,000,000", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  const first = await (await page.request.get("/api/dashboard")).json();
  test.skip(!first.publicWallet, "Custody master key is not configured");
  expect(first.publicWallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  expect(JSON.stringify(first)).not.toMatch(
    /ciphertext|privateKey|CUSTODY_MASTER_KEY/,
  );
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeEnabled({
    timeout: 60000,
  });
  const second = await (await page.request.get("/api/dashboard")).json();
  expect(second.publicWallet).toEqual(first.publicWallet);
  await page.screenshot({ path: "/tmp/td-sepolia-wallet.png", fullPage: true });
});
