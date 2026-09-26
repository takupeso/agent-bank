"use client";
import { apiFetch } from "./api-client";
import { formatUsdc } from "@/shared/format";
import type { AccountMovement } from "@/shared/domain";
import { useCallback, useEffect, useRef, useState } from "react";

type View = {
  initialized: boolean;
  mode?: string;
  profile?: string;
  td?: string;
  positionUsdc?: string;
  looseUsdc?: string;
  movements?: AccountMovement[];
};

function yen(value: string) {
  return `¥${BigInt(value).toLocaleString("en-US")}`;
}

function AccountCard({
  title,
  subtitle,
  balance,
  movements,
}: {
  title: string;
  subtitle?: string;
  balance: string;
  movements: AccountMovement[];
}) {
  return (
    <section className="account-card">
      <div className="account-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <strong key={balance} className="account-balance">
          {balance}
        </strong>
      </div>
      <div className="account-activity">
        <h3>Transactions</h3>
        {movements.length ? (
          <ul>
            {movements.slice(0, 4).map((movement) => (
              <li key={movement.id}>
                <span
                  className={`movement-direction ${movement.direction}`}
                  aria-label={movement.direction === "in" ? "Credit" : "Debit"}
                >
                  {movement.direction === "in" ? "Credit" : "Debit"}
                </span>
                <span className="movement-label">{movement.label}</span>
                <strong className={movement.direction}>
                  {movement.direction === "in" ? "+" : "−"}
                  {movement.unit === "JPY"
                    ? yen(movement.amount)
                    : `${formatUsdc(movement.amount)} USDC`}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="account-empty">No transactions yet.</p>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState<View>({ initialized: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const loading = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await apiFetch("/api/dashboard", {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("Unable to refresh balances.");
      setData(await r.json());
      setRefreshError("");
    } catch {
      setRefreshError("Unable to refresh balances. Waiting to reconnect.");
    } finally {
      loading.current = false;
    }
  }, []);
  useEffect(() => {
    const refresh = () => void load();
    void load();
    const poll = window.setInterval(refresh, 1500);
    window.addEventListener("agent-bank:invoices-updated", refresh);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("agent-bank:invoices-updated", refresh);
    };
  }, [load]);
  async function reset() {
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        const result = await r.json();
        throw new Error(result.error ?? "Unable to initialize the demo");
      }
      await load();
      window.dispatchEvent(new Event("agent-bank:demo-reset"));
      window.dispatchEvent(new Event("agent-bank:invoices-updated"));
      window.dispatchEvent(new Event("agent-bank:rules-updated"));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const movements = data.movements ?? [];
  const forAccount = (account: AccountMovement["account"]) =>
    movements.filter((movement) => movement.account === account);
  return (
    <>
      <header>
        <h1>Accounts</h1>
        <p>
          View balances and transactions across your deposit and investment
          accounts.
        </p>
      </header>
      <div className="toolbar">
        {data.mode !== "sepolia" && <span className="badge">Local demo</span>}
        {data.profile === "ten-usdc" && (
          <span className="badge">10 USDC starter</span>
        )}
        <button onClick={() => void reset()} disabled={busy}>
          {busy
            ? "Initializing…"
            : data.initialized
              ? "Reset demo"
              : "Initialize demo"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {refreshError && <p role="status">{refreshError}</p>}

      <div className="account-list">
        <AccountCard
          title="Deposit account"
          subtitle="Account A"
          balance={yen(data.td ?? "0")}
          movements={forAccount("deposit")}
        />
        <AccountCard
          title="Token account"
          balance={`${formatUsdc(data.looseUsdc ?? "0")} USDC`}
          movements={forAccount("token")}
        />
        <AccountCard
          title="Aave"
          subtitle={data.mode === "sepolia" ? "Base Sepolia" : "Local stub"}
          balance={`${formatUsdc(data.positionUsdc ?? "0")} USDC`}
          movements={forAccount("aave")}
        />
      </div>
    </>
  );
}
