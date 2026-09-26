"use client";
import { apiFetch } from "../api-client";
import { useState } from "react";
import type { Run } from "@/shared/domain";
export function RunDetails({ run }: { run: Run }) {
  return (
    <details className="card">
      <summary>実行詳細</summary>
      <p>
        {run.status === "completed" ? "完了" : "実行記録"} · {run.kind}
      </p>
      {run.sourceId && (
        <p>
          根拠：{run.sourceId} /{" "}
          {run.kind === "redemption"
            ? "チャットの明示依頼により実行"
            : `適用ルール：第${run.ruleVersion}版`}
        </p>
      )}
      {run.steps.map((s, i) => (
        <div key={i}>
          <b>
            {s.label} ·{" "}
            {s.mode === "stub"
              ? "模擬処理"
              : s.mode === "sepolia"
                ? "Sepolia確認済み"
                : "Anvil確定"}
          </b>
          {s.hash && (
            <p className="hash">
              Tx:{" "}
              {s.mode === "sepolia" ? (
                <a
                  href={`https://${s.chainId === 84532 ? "sepolia.basescan.org" : "sepolia.etherscan.io"}/tx/${s.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.hash}
                </a>
              ) : (
                s.hash
              )}
              <br />
              Block: {s.block}
            </p>
          )}
        </div>
      ))}
    </details>
  );
}
export function DemoEvent({
  type,
  label,
  onComplete,
  onError,
}: {
  type: string;
  label: string;
  onComplete: () => void;
  onError?: (error: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  async function execute() {
    setBusy(true);
    setError("");
    const requestId = crypto.randomUUID();
    const poll = setInterval(() => {
      apiFetch("/api/runs/" + requestId).then(async (r) => {
        if (r.ok) setRun(await r.json());
      });
    }, 300);
    try {
      const r = await apiFetch("/api/demo/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, requestId }),
      });
      if (!r.ok) throw new Error("処理を完了できませんでした");
      setRun(await r.json());
      onComplete();
    } catch (e) {
      setError(String(e));
      onError?.(String(e));
    } finally {
      clearInterval(poll);
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy} onClick={execute}>
        {busy ? "実行中…" : label}
      </button>
      {run && <RunDetails run={run} />} {error && <p role="alert">{error}</p>}
    </>
  );
}
