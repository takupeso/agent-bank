import { test, expect } from "@playwright/test";
import { approveApi } from "./helpers";
test("ten USDC profile proposes and redeems exactly 1600 TD locally", async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.SMALL_PROFILE_TEST !== "1",
    "Explicit small profile server required",
  );
  const origin = new URL(baseURL!).origin;
  await page.context().setExtraHTTPHeaders({ Origin: origin });
  expect(
    (
      await page.request.post("/api/auth/demo-login", {
        data: {},
        headers: { Origin: origin },
      })
    ).ok(),
  ).toBeTruthy();
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post(path, { data });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  await post("/api/demo/reset", {});
  let messages = await post("/api/chat/messages", {
    text: "サンプルメールの閲覧を許可して確認して",
  });
  await approveApi(page.request, messages.at(-1).data.input, origin);
  messages = await post("/api/chat/messages", {
    text: "サンプルメールの閲覧を許可して確認して",
  });
  let proposal = messages.findLast(
    (m: { kind: string }) => m.kind === "proposal",
  ).data.proposal;
  await post("/api/chat/messages", {
    text: "そうしてください",
    proposalId: proposal.id,
  });
  await approveApi(
    page.request,
    { purpose: "proposal", proposalId: proposal.id },
    origin,
  );
  await post("/api/demo/events", {
    type: "due_date_reached",
    requestId: crypto.randomUUID(),
  });
  messages = await post("/api/chat/messages", { text: "余力を運用したい" });
  proposal = messages.findLast((m: { kind: string }) => m.kind === "proposal")
    .data.proposal;
  expect(proposal.conditions.maxInvestmentJpy).toBe("1600");
  await post("/api/chat/messages", {
    text: "そうしてください",
    proposalId: proposal.id,
  });
  await approveApi(
    page.request,
    { purpose: "proposal", proposalId: proposal.id },
    origin,
  );
  await post("/api/demo/events", {
    type: "surplus_check",
    requestId: crypto.randomUUID(),
  });
  const invested = await (await page.request.get("/api/dashboard")).json();
  expect(invested.locked).toBe("1600");
  expect(invested.positionUsdc).toBe("10000000");
  await page.goto("/investment");
  await expect(page.getByText("10 USDC", { exact: true })).toBeVisible();
  await post("/api/chat/messages", { text: "運用分を全部TDに戻して" });
  const after = await (await page.request.get("/api/dashboard")).json();
  expect(after.td).toBe("800000");
  expect(after.locked).toBe("0");
});
