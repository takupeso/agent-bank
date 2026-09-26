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
  investmentProgress?: {
    runId: string;
    status: "running" | "completed" | "needs_attention";
    completedStages: number;
  } | null;
};

function yen(value: string) {
  return `¥${BigInt(value).toLocaleString("ja-JP")}`;
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
        <h3>入出金</h3>
        {movements.length ? (
          <ul>
            {movements.slice(0, 4).map((movement) => (
              <li key={movement.id}>
                <span
                  className={`movement-direction ${movement.direction}`}
                  aria-label={movement.direction === "in" ? "入金" : "出金"}
                >
                  {movement.direction === "in" ? "入金" : "出金"}
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
          <p className="account-empty">入出金履歴はありません。</p>
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
      if (!r.ok) throw new Error("残高を更新できませんでした。");
      setData(await r.json());
      setRefreshError("");
    } catch {
      setRefreshError("残高を更新できませんでした。再接続を待っています。");
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
        throw new Error(result.error ?? "初期化できませんでした");
      }
      await load();
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
        <h1>口座</h1>
        <p>預金口座と運用先の残高、入出金を確認できます。</p>
      </header>
      <div className="toolbar">
        <span className="badge">
          {data.mode === "sepolia" ? "Sepolia接続デモ" : "ローカルデモ"}
          {data.profile === "ten-usdc" ? " · 初回10 USDC" : ""}
        </span>
        <button onClick={() => void reset()} disabled={busy}>
          {busy
            ? "初期化中…"
            : data.initialized
              ? "デモをリセット"
              : "デモを初期化"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {refreshError && <p role="status">{refreshError}</p>}

      {data.investmentProgress && (
        <section className="investment-progress" aria-label="運用の進行状況">
          <ol>
            {["預金口座", "トークン口座", "Aave"].map((label, index) => {
              const progress = data.investmentProgress!;
              const done = index < progress.completedStages;
              const active = index === progress.completedStages;
              return (
                <li
                  key={label}
                  data-state={done ? "complete" : active ? "active" : "pending"}
                  aria-current={active ? "step" : undefined}
                >
                  <b>{label}</b>
                  <span>
                    {done
                      ? ["TD確保済み", "USDC受取済み", "預入完了"][index]
                      : active
                        ? progress.status === "needs_attention"
                          ? "要確認"
                          : [
                              "TDを確保中",
                              "USDC受取の確定待ち",
                              "Aave預入の確定待ち",
                            ][index]
                        : "待機中"}
                  </span>
                </li>
              );
            })}
          </ol>
          <p role="status">
            {data.investmentProgress.status === "needs_attention"
              ? "処理が停止しました。実行記録を確認してください。"
              : data.investmentProgress.completedStages === 3
                ? "Aaveへの預入が完了しました。"
                : "取引の確定に合わせて残高と入出金を更新しています。"}
          </p>
        </section>
      )}
      <div className="account-list">
        <AccountCard
          title="預金口座"
          subtitle="口座A"
          balance={yen(data.td ?? "0")}
          movements={forAccount("deposit")}
        />
        <AccountCard
          title="トークン口座"
          balance={`${formatUsdc(data.looseUsdc ?? "0")} USDC`}
          movements={forAccount("token")}
        />
        <AccountCard
          title="Aave"
          subtitle={data.mode === "sepolia" ? "Base Sepolia" : "ローカルstub"}
          balance={`${formatUsdc(data.positionUsdc ?? "0")} USDC`}
          movements={forAccount("aave")}
        />
        <AccountCard
          title="Morpho"
          subtitle="未接続"
          balance="—"
          movements={[]}
        />
      </div>
    </>
  );
}
