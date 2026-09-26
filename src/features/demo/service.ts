import { requirePrincipal, type Principal } from "../../server/auth";
import "server-only";
import { balances, assertResettable } from "../../integrations/aave/sepolia";
import {
  ensureCustomerWallet,
  walletInfo,
  customerAccountId,
} from "../../integrations/custody";
import { all } from "../../server/records";
import type {
  AccountMovement,
  Invoice,
  Payment,
  Run,
} from "../../shared/domain";
import { randomUUID } from "node:crypto";
import {
  acquire,
  release,
  db,
  sqlite,
  instances,
  current,
} from "../../server/db";
import {
  deploy,
  write,
  op,
  customer,
  recipient,
  balance,
} from "../../integrations/td-ledger";
import { requireWorldEnrollment, worldRequired } from "../world/service";
export async function reset(principal: Principal) {
  requirePrincipal(principal, "human");
  requireWorldEnrollment();
  const profile = process.env.DEMO_PROFILE ?? "standard";
  if (!["standard", "ten-usdc"].includes(profile))
    throw new Error("Invalid demo profile");
  const publicMode = process.env.PUBLIC_ASSET_MODE ?? "stub";
  if (publicMode !== "stub" && publicMode !== "sepolia")
    throw new Error("Invalid asset mode");
  const id = randomUUID();
  const publicWallet = process.env.CUSTODY_MASTER_KEY
    ? ensureCustomerWallet()
    : null;
  if (process.env.PUBLIC_ASSET_MODE === "sepolia" && !publicWallet)
    throw new Error("Custody key required");
  acquire(id);
  let deployStarted = false;
  try {
    const old = current();
    if (
      old &&
      (all<{ status: string }>("investment_orders").some(
        (o) => o.status !== "redeemed",
      ) ||
        BigInt(await balance(old.token, old.vault)) !== 0n)
    )
      throw new Error("Redeem all positions before reset");
    if (old?.publicMode === "sepolia") {
      if (publicMode !== "sepolia")
        throw new Error("Cannot hide public assets by switching mode");
      assertResettable();
      if (BigInt(await balance(old.token, old.vault)) !== 0n)
        throw new Error("TD locks remain");
    }
    deployStarted = true;
    const { token, vault } = await deploy();
    const result = await write(token, "BankTD", "mintTo", [
      customer,
      1000000n,
      op(id + ":mint"),
    ]);
    if (!result.events.length) throw new Error("Missing mint evidence");
    const state = {
      id,
      clock: "2026-09-22T00:00:00.000Z",
      token,
      vault,
      customer,
      recipient,
      publicWallet,
      publicMode,
      profile,
      worldRequired: worldRequired(),
      initialization: { hash: result.hash, block: result.block },
      positionUsdc: "0",
      treasuryUsdc: publicMode === "stub" ? "10000000000" : "0",
    };
    sqlite.transaction(() => {
      db.insert(instances)
        .values({ id, status: "ready", state: JSON.stringify(state) })
        .run();
      sqlite.prepare("UPDATE control SET active_instance=? WHERE id=1").run(id);
    })();
    release(id);
    return state;
  } catch (e) {
    if (!deployStarted) release(id);
    throw e;
  }
}
export async function dashboard() {
  const s = current();
  if (!s)
    return {
      initialized: false,
      configuredMode: process.env.PUBLIC_ASSET_MODE ?? "stub",
    };
  const [td, recipientTd, locked] = await Promise.all([
    balance(s.token, s.customer),
    balance(s.token, s.recipient),
    balance(s.token, s.vault),
  ]);
  const payments = all<Payment>("payment_history").filter(
    (payment) => payment.status === "confirmed",
  );
  const investments = all<{
    id: string;
    amountJpy: string;
    usdcUnits: string;
    status: "locked" | "invested" | "redeemed";
  }>("investment_orders");
  const redemptions = all<{ id: string; status: string }>("redemption_orders")
    .filter((redemption) => redemption.status === "completed")
    .map((redemption) => redemption.id.slice(redemption.id.indexOf(":") + 1));
  const movements: AccountMovement[] = [
    {
      id: s.id + ":initial",
      account: "deposit",
      direction: "in",
      amount: "1000000",
      unit: "JPY",
      label: "デモ初期残高",
    },
    ...payments.map((payment) => ({
      id: payment.id,
      account: "deposit" as const,
      direction: "out" as const,
      amount: payment.amountJpy,
      unit: "JPY" as const,
      label: "請求書の支払い",
    })),
    ...investments
      .filter(
        (order) => order.status === "invested" || order.status === "redeemed",
      )
      .flatMap((order) => [
        {
          id: order.id + ":deposit-out",
          account: "deposit" as const,
          direction: "out" as const,
          amount: order.amountJpy,
          unit: "JPY" as const,
          label: "運用分をトークン口座へ移動",
        },
        {
          id: order.id + ":token-in",
          account: "token" as const,
          direction: "in" as const,
          amount: order.amountJpy,
          unit: "JPY" as const,
          label: "運用分を確保",
        },
        {
          id: order.id + ":aave-in",
          account: "aave" as const,
          direction: "in" as const,
          amount: order.usdcUnits,
          unit: "USDC" as const,
          label: "Aaveへ預入",
        },
        ...(redemptions.includes(order.id)
          ? [
              {
                id: order.id + ":aave-out",
                account: "aave" as const,
                direction: "out" as const,
                amount: order.usdcUnits,
                unit: "USDC" as const,
                label: "Aaveから引出し",
              },
              {
                id: order.id + ":token-out",
                account: "token" as const,
                direction: "out" as const,
                amount: order.amountJpy,
                unit: "JPY" as const,
                label: "運用分を預金へ返却",
              },
              {
                id: order.id + ":deposit-in",
                account: "deposit" as const,
                direction: "in" as const,
                amount: order.amountJpy,
                unit: "JPY" as const,
                label: "償還したTD",
              },
            ]
          : []),
      ]),
  ];
  return {
    initialized: true,
    configuredMode: process.env.PUBLIC_ASSET_MODE ?? "stub",
    publicTransactionsEnabled:
      process.env.PUBLIC_TRANSACTIONS_ENABLED === "true",
    ...s,
    td,
    recipientTd,
    locked,
    upcoming: all<Invoice>("invoices").filter((i) => i.status !== "paid"),
    recent: all<Run>("runs").slice(-3).reverse(),
    movements: movements.reverse(),
    publicWallet: walletInfo(customerAccountId),
    ...(s.publicMode === "sepolia" ? await balances() : {}),
    mode: s.publicMode ?? "stub",
  };
}
