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
  const [flow, setFlow] = useState<Flow | null>(null);
  const [position, setPosition] = useState("0");
  async function load() {
    const [f, d] = await Promise.all([
      apiFetch("/api/cashflow"),
      apiFetch("/api/dashboard"),
    ]);
    if (f.ok) setFlow(await f.json());
    if (d.ok) {
      const data = await d.json();
      setMode(data.mode);
      setPosition(data.positionUsdc ?? "0");
    }
  }
  useEffect(() => {
    const refresh = () => void load();
    refresh();
    window.addEventListener("agent-bank:invoices-updated", refresh);
    return () =>
      window.removeEventListener("agent-bank:invoices-updated", refresh);
  }, []);
  return (
    <>
      <header className="page-header">
        <h1>Investment plan</h1>
        <p>Keep funds for month-end needs and invest the available balance.</p>
      </header>
      {flow && (
        <>
          <div className="investment-plan">
            <section className="panel" aria-labelledby="deposit-balance-title">
              <div className="plan-total">
                <h2 id="deposit-balance-title">Deposit balance</h2>
                <strong>¥{BigInt(flow.td).toLocaleString("en-US")}</strong>
              </div>
              {BigInt(flow.td) > 0n && (
                <div className="plan-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${BigInt(flow.reserveJpy) >= BigInt(flow.td) ? 100n : (BigInt(flow.reserveJpy) * 100n) / BigInt(flow.td)}%`,
                    }}
                  />
                </div>
              )}
              <div className="plan-legend" aria-hidden="true">
                <span className="reserve">Reserved</span>
                <span className="available">Investable</span>
              </div>
            </section>
            <section className="panel" aria-labelledby="reserved-funds-title">
              <div className="plan-total">
                <h2 id="reserved-funds-title">Reserved funds</h2>
                <strong>
                  ¥{BigInt(flow.reserveJpy).toLocaleString("en-US")}
                </strong>
              </div>
              <section
                className="plan-breakdown"
                aria-labelledby="reserve-breakdown-title"
              >
                <h3 id="reserve-breakdown-title">
                  Breakdown through month-end
                </h3>
                <dl>
                  <div>
                    <dt>Confirmed invoice payments</dt>
                    <dd>
                      ¥{BigInt(flow.confirmedJpy).toLocaleString("en-US")}
                    </dd>
                  </div>
                  <div>
                    <dt>Forecast from history (Minato Cloud)</dt>
                    <dd>
                      ¥{BigInt(flow.predictedJpy).toLocaleString("en-US")}
                    </dd>
                  </div>
                  <div>
                    <dt>Safety buffer</dt>
                    <dd>¥{BigInt(flow.bufferJpy).toLocaleString("en-US")}</dd>
                  </div>
                </dl>
              </section>
            </section>
            <section
              className="panel"
              aria-labelledby="investment-assets-title"
            >
              <h2 id="investment-assets-title">Investment assets</h2>
              <div className="plan-investments">
                <section aria-labelledby="invested-title">
                  <h3 id="invested-title">Invested</h3>
                  <strong>{formatUsdc(position)} USDC</strong>
                  {mode === "stub" && (
                    <p className="plan-caption">Simulation</p>
                  )}
                </section>
                <section aria-labelledby="investable-title">
                  <h3 id="investable-title">Available to invest</h3>
                  <strong>
                    ¥{BigInt(flow.investJpy).toLocaleString("en-US")}
                  </strong>
                </section>
              </div>
            </section>
          </div>
          <div className="quick-actions">
            <DemoEvent
              type="surplus_check"
              label="Demo: Check available funds"
              onComplete={() => void load()}
            />
          </div>
        </>
      )}
      {!flow && (
        <section className="panel">Initialize the demo on Home first.</section>
      )}
    </>
  );
}
