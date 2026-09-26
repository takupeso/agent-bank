"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountMovement } from "@/shared/domain";

type Edge = "pay" | "wallet" | "aave";
type Flow = {
  id: string;
  edge: Edge;
  reverse: boolean;
  amount: string;
  caption: string;
  target: "payees" | "deposit" | "wallet" | "aave";
};

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const yenShort = (value: bigint) => `¥${compact.format(value)}`;
const usdcShort = (units: bigint) => `${compact.format(units / 1000000n)} USDC`;

// Each operation produces several ledger rows; animate one representative row per hop.
function toFlow(m: AccountMovement): Flow | undefined {
  const amount = BigInt(m.amount);
  if (m.label === "Invoice payment")
    return {
      id: m.id,
      edge: "pay",
      reverse: true,
      amount: yenShort(amount),
      caption: "Agent paid an invoice within your limits",
      target: "payees",
    };
  if (m.id.endsWith(":deposit-out"))
    return {
      id: m.id,
      edge: "wallet",
      reverse: false,
      amount: yenShort(amount),
      caption: "Agent reserved surplus TD and received USDC",
      target: "wallet",
    };
  if (m.id.endsWith(":aave-in"))
    return {
      id: m.id,
      edge: "aave",
      reverse: false,
      amount: usdcShort(amount),
      caption: "Agent supplied USDC to Aave",
      target: "aave",
    };
  if (m.id.endsWith(":aave-out"))
    return {
      id: m.id,
      edge: "aave",
      reverse: true,
      amount: usdcShort(amount),
      caption: "Agent withdrew USDC from Aave",
      target: "wallet",
    };
  if (m.id.endsWith(":deposit-in"))
    return {
      id: m.id,
      edge: "wallet",
      reverse: true,
      amount: yenShort(amount),
      caption: "Invested funds returned to your deposit",
      target: "deposit",
    };
}
const order = (f: Flow) =>
  f.target === "payees"
    ? 0
    : f.edge === "wallet" && !f.reverse
      ? 1
      : f.edge === "aave" && !f.reverse
        ? 2
        : f.edge === "aave"
          ? 3
          : 4;

const STEP_MS = 1600;

export function MoneyFlow({
  movements,
  td,
  walletUsdc,
  aaveUsdc,
  simulated,
}: {
  movements: AccountMovement[];
  td: string;
  walletUsdc: string;
  aaveUsdc: string;
  simulated: boolean;
}) {
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<Flow[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<Flow>();
  const [runKey, setRunKey] = useState(0);

  const playNext = useCallback(() => {
    const next = queue.current.shift();
    setActive(next);
    setRunKey((k) => k + 1);
    timer.current = next ? window.setTimeout(playNext, STEP_MS) : undefined;
  }, []);
  const enqueue = useCallback(
    (flows: Flow[]) => {
      queue.current.push(...flows.sort((a, b) => order(a) - order(b)));
      if (timer.current === undefined) playNext();
    },
    [playNext],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const ids = new Set(movements.map((m) => m.id));
    if (seen.current === null) {
      if (movements.length) seen.current = ids;
      return;
    }
    const fresh = movements.filter((m) => !seen.current!.has(m.id));
    seen.current = ids;
    const flows = fresh.map(toFlow).filter((f): f is Flow => !!f);
    if (flows.length) enqueue(flows);
  }, [movements, enqueue]);

  const history = movements.map(toFlow).filter((f): f is Flow => !!f);
  const paid = movements
    .filter((m) => m.label === "Invoice payment")
    .reduce((sum, m) => sum + BigInt(m.amount), 0n);

  const node = (
    key: Flow["target"],
    title: string,
    value: string,
    note: string,
  ) => (
    <div
      className={`flow-node ${key}${active?.target === key ? " receiving" : ""}`}
      key={active?.target === key ? `${key}-${runKey}` : key}
    >
      <span className="flow-node-title">{title}</span>
      <span className="flow-node-value">{value}</span>
      <span className="flow-node-note">{note}</span>
    </div>
  );
  const line = (edge: Edge) => (
    <div
      className={`flow-line ${edge}${active?.edge === edge ? " active" : ""}`}
      aria-hidden="true"
    >
      <i />
      {active?.edge === edge && (
        <span
          key={runKey}
          className={`flow-coin${active.reverse ? " reverse" : ""}`}
        >
          {active.amount}
        </span>
      )}
    </div>
  );

  return (
    <section className="money-flow" aria-labelledby="money-flow-title">
      <div className="money-flow-header">
        <h2 id="money-flow-title">Money flow</h2>
        <button
          type="button"
          className="secondary"
          disabled={!history.length || !!active}
          onClick={() => enqueue([...history])}
        >
          Replay
        </button>
      </div>
      <div className="flow-track">
        {node("payees", "Payees", yenShort(paid), "Paid by agent")}
        {line("pay")}
        {node("deposit", "Deposit", yenShort(BigInt(td)), "TD · Account A")}
        {line("wallet")}
        {node(
          "wallet",
          "Wallet",
          usdcShort(BigInt(walletUsdc)),
          "Token account",
        )}
        {line("aave")}
        {node(
          "aave",
          "Aave",
          usdcShort(BigInt(aaveUsdc)),
          simulated ? "Simulation" : "Base Sepolia",
        )}
      </div>
      <p className="flow-status" role="status">
        <span
          className={`agent-status${active ? " busy" : ""}`}
          aria-hidden="true"
        />
        {active
          ? `${active.caption} · ${active.amount}`
          : "Agent is watching your accounts. Transfers appear here as they happen."}
      </p>
    </section>
  );
}
