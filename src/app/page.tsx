"use client";
import { apiFetch } from "./api-client";
import { formatUsdc } from "@/shared/format";
import type { AccountMovement } from "@/shared/domain";
import { useEffect, useState } from "react";

type View = {
  initialized: boolean;
  mode?: string;
  profile?: string;
  td?: string;
  positionUsdc?: string;
  locked?: string;
  movements?: AccountMovement[];
};

function yen(value: string) {
  return `¥${BigInt(value).toLocaleString("ja-JP")}`;
}

function AccountCard({
  title,
  subtitle,
  balance,
  note,
  movements,
}: {
  title: string;
  subtitle: string;
  balance: string;
  note: string;
  movements: AccountMovement[];
}) {
  return (
    <section className="account-card">
      <div className="account-card-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <strong>{balance}</strong>
      </div>
      <p className="account-note">{note}</p>
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
  async function load() {
    const r = await apiFetch("/api/dashboard");
    if (r.ok) setData(await r.json());
  }
  useEffect(() => {
    void load();
  }, []);
  async function reset() {
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("初期化できませんでした");
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

      <div className="account-list">
        <AccountCard
          title="預金口座"
          subtitle="口座A · 利用可能な残高"
          balance={yen(data.td ?? "0")}
          note="TD · 1 TD = 1円"
          movements={forAccount("deposit")}
        />
        <AccountCard
          title="トークン口座"
          subtitle="運用に対応するTD"
          balance={yen(data.locked ?? "0")}
          note="運用分として確保中の残高です。預金口座と重ねて合算しません。"
          movements={forAccount("token")}
        />
        <AccountCard
          title="Aave"
          subtitle={data.mode === "sepolia" ? "Base Sepolia" : "ローカルstub"}
          balance={`${formatUsdc(data.positionUsdc ?? "0")} USDC`}
          note="Aaveで運用中のUSDC残高"
          movements={forAccount("aave")}
        />
        <AccountCard
          title="Morpho"
          subtitle="未接続"
          balance="—"
          note="接続後に運用残高と入出金履歴を表示します。"
          movements={[]}
        />
      </div>
    </>
  );
}
