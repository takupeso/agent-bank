"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountMovement } from "@/shared/domain";

type Place = "Deposit" | "Wallet" | "Aave" | "Payee";
type Flow = {
  id: string;
  from: Place;
  to: Place;
  amount: bigint;
  unit: "JPY" | "USDC";
  caption: string;
  tone: "pay" | "invest";
};

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const short = (f: Flow) =>
  f.unit === "JPY"
    ? `¥${compact.format(f.amount)}`
    : `${compact.format(f.amount / 1000000n)} USDC`;

// Each operation produces several ledger rows; show one representative row per hop.
function toFlow(m: AccountMovement): Flow | undefined {
  const amount = BigInt(m.amount);
  if (m.label === "Invoice payment")
    return {
      id: m.id,
      from: "Deposit",
      to: "Payee",
      amount,
      unit: "JPY",
      caption: "Agent paid an invoice within your limits",
      tone: "pay",
    };
  if (m.id.endsWith(":deposit-out"))
    return {
      id: m.id,
      from: "Deposit",
      to: "Wallet",
      amount,
      unit: "JPY",
      caption: "Agent moved TD into investment and received USDC",
      tone: "invest",
    };
  if (m.id.endsWith(":aave-in"))
    return {
      id: m.id,
      from: "Wallet",
      to: "Aave",
      amount,
      unit: "USDC",
      caption: "Agent supplied USDC to Aave",
      tone: "invest",
    };
  if (m.id.endsWith(":aave-out"))
    return {
      id: m.id,
      from: "Aave",
      to: "Wallet",
      amount,
      unit: "USDC",
      caption: "Agent withdrew USDC from Aave",
      tone: "invest",
    };
  if (m.id.endsWith(":deposit-in"))
    return {
      id: m.id,
      from: "Wallet",
      to: "Deposit",
      amount,
      unit: "JPY",
      caption: "Invested funds returned to your deposit",
      tone: "invest",
    };
}
// Play hops in the order money actually travels: withdrawals fund payments, then new investments.
const hops = [
  "Aave>Wallet",
  "Wallet>Deposit",
  "Deposit>Payee",
  "Deposit>Wallet",
  "Wallet>Aave",
];
const stage = (f: Flow) => hops.indexOf(`${f.from}>${f.to}`);

const STEP_MS = 1800;
const LINGER_MS = 2200;

export function MoneyFlow({ movements }: { movements: AccountMovement[] }) {
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<Flow[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<Flow>();
  const [leaving, setLeaving] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const toast = useRef<HTMLDivElement>(null);
  // A popover joins the top layer, so the toast stays visible above the demo drawer.
  useEffect(() => {
    if (active && !toast.current?.matches(":popover-open"))
      toast.current?.showPopover();
  }, [active]);

  const playNext = useCallback(() => {
    const next = queue.current.shift();
    if (next) {
      setLeaving(false);
      setActive(next);
      setRunKey((k) => k + 1);
      timer.current = window.setTimeout(playNext, STEP_MS);
      return;
    }
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setActive(undefined);
      setLeaving(false);
      timer.current = undefined;
    }, LINGER_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const ids = new Set(movements.map((m) => m.id));
    if (seen.current === null) {
      if (movements.length) seen.current = ids;
      return;
    }
    const fresh = movements.filter((m) => !seen.current!.has(m.id));
    seen.current = ids;
    const flows: Flow[] = [];
    for (const flow of fresh
      .map(toFlow)
      .filter((f): f is Flow => !!f)
      .sort((a, b) => stage(a) - stage(b))) {
      const same = flows.find((f) => f.from === flow.from && f.to === flow.to);
      if (same) same.amount += flow.amount;
      else flows.push(flow);
    }
    if (!flows.length) return;
    queue.current.push(...flows);
    if (timer.current === undefined || leaving) {
      window.clearTimeout(timer.current);
      playNext();
    }
  }, [movements, playNext, leaving]);

  if (!active) return null;
  return (
    <div
      ref={toast}
      popover="manual"
      className={`flow-toast ${active.tone}${leaving ? " leaving" : ""}`}
      role="status"
    >
      <div className="flow-route" aria-hidden="true">
        <span>{active.from}</span>
        <div className="flow-line">
          <i />
          <b key={runKey} className="flow-coin" />
        </div>
        <span>{active.to}</span>
      </div>
      <p>
        <strong>{short(active)}</strong>
        {active.caption}
      </p>
    </div>
  );
}
