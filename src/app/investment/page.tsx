"use client";
import { apiFetch } from "../api-client";
import { formatUsdc } from "@/shared/format";
import { useEffect, useState } from "react";
import { DemoEvent } from "../chat/demo-event";
type Flow = {
  td: string;
  confirmedJpy: string;
  predictedJpy: string;
  bufferJpy: string;
  reserveJpy: string;
  investJpy: string;
};
export default function Investment() {
  const [mode, setMode] = useState("stub");
  const [interest, setInterest] = useState("0");
  const [principal, setPrincipal] = useState("0");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [position, setPosition] = useState("0");
  const [locked, setLocked] = useState("0");
  async function load() {
    const [f, d] = await Promise.all([
      apiFetch("/api/cashflow"),
      apiFetch("/api/dashboard"),
    ]);
    if (f.ok) setFlow(await f.json());
    if (d.ok) {
      const data = await d.json();
      setMode(data.mode);
      setInterest(data.interestUsdc ?? "0");
      setPrincipal(data.principalUsdc ?? data.positionUsdc ?? "0");
      setPosition(data.positionUsdc ?? "0");
      setLocked(data.locked ?? "0");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <header>
        <h1>資金計画・運用</h1>
        <p>月末までのお金を確保し、現在の余力を運用します。</p>
        <span className="badge">
          {mode === "sepolia"
            ? "Base Sepolia · Aave疑似USDC / 実残高"
            : "Aave・USDCは模擬処理 / 利息0・APY未取得"}
        </span>
      </header>
      {flow && (
        <>
          <section className="metrics">
            {[
              ["利用可能なTD", flow.td],
              ["確保する資金", flow.reserveJpy],
              ["追加で運用できる額", flow.investJpy],
            ].map(([title, value]) => (
              <article key={title}>
                <p>{title}</p>
                <strong>¥{BigInt(value).toLocaleString()}</strong>
              </article>
            ))}
          </section>
          <section className="panel">
            <h2>月末までの内訳</h2>
            <p>確定未払：¥{BigInt(flow.confirmedJpy).toLocaleString()}</p>
            <p>
              履歴からの予測：¥{BigInt(flow.predictedJpy).toLocaleString()}
              （ミナトクラウド）
            </p>
            <p>予備資金：¥{BigInt(flow.bufferJpy).toLocaleString()}</p>
            <h2>運用資産（{mode === "sepolia" ? "Sepolia Aave" : "stub"}）</h2>
            <strong>{formatUsdc(position)} USDC</strong>
            <p>
              対応するTD lock：¥{BigInt(locked).toLocaleString()}
              （資産合計に二重計上しません）
            </p>
            {mode === "sepolia" && (
              <p>
                対応元本 {formatUsdc(principal)} USDC · 利息相当{" "}
                {formatUsdc(interest)} USDC（TD償還対象外）
              </p>
            )}
            <p>1 USDC = 160円 · 手数料0</p>
          </section>
          <div className="quick-actions">
            <DemoEvent
              type="surplus_check"
              label="デモ：余力をチェック"
              onComplete={() => void load()}
            />
          </div>
        </>
      )}
      {!flow && (
        <section className="panel">
          先にホームでデモを初期化してください。
        </section>
      )}
    </>
  );
}
