"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountMovement } from "@/shared/domain";

type Place = "Deposit" | "Wallet" | "Aave" | "Payee";
type Flow = {
  id: string;
  from: Place;
  to: Place;
  amount: string;
  caption: string;
  tone: "pay" | "invest";
};

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const yenShort = (value: bigint) => `¥${compact.format(value)}`;
const usdcShort = (units: bigint) => `${compact.format(units / 1000000n)} USDC`;

// Each operation produces several ledger rows; show one representative row per hop.
function toFlow(m: AccountMovement): Flow | undefined {
  const amount = BigInt(m.amount);
  if (m.label === "Invoice payment")
    return {
      id: m.id,
      from: "Deposit",
      to: "Payee",
      amount: yenShort(amount),
      caption: "Agent paid an invoice within your limits",
      tone: "pay",
    };
  if (m.id.endsWith(":deposit-out"))
    return {
      id: m.id,
      from: "Deposit",
      to: "Wallet",
      amount: yenShort(amount),
      caption: "Agent reserved surplus TD and received USDC",
      tone: "invest",
    };
  if (m.id.endsWith(":aave-in"))
    return {
      id: m.id,
      from: "Wallet",
      to: "Aave",
      amount: usdcShort(amount),
      caption: "Agent supplied USDC to Aave",
      tone: "invest",
    };
  if (m.id.endsWith(":aave-out"))
    return {
      id: m.id,
      from: "Aave",
      to: "Wallet",
      amount: usdcShort(amount),
      caption: "Agent withdrew USDC from Aave",
      tone: "invest",
    };
  if (m.id.endsWith(":deposit-in"))
    return {
      id: m.id,
      from: "Wallet",
      to: "Deposit",
      amount: yenShort(amount),
      caption: "Invested funds returned to your deposit",
      tone: "invest",
    };
}
const stage = (f: Flow) =>
  ["Payee", "Wallet", "Aave", "Wallet", "Deposit"].indexOf(f.to) +
  (f.from === "Aave" ? 1 : 0);

const STEP_MS = 1800;
const LINGER_MS = 2200;

export function MoneyFlow({ movements }: { movements: AccountMovement[] }) {
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<Flow[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<Flow>();
  const [leaving, setLeaving] = useState(false);
  const [runKey, setRunKey] = useState(0);

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
    const flows = fresh
      .map(toFlow)
      .filter((f): f is Flow => !!f)
      .sort((a, b) => stage(a) - stage(b));
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
        <strong>{active.amount}</strong>
        {active.caption}
      </p>
    </div>
  );
}
