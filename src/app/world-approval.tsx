"use client";
import { useEffect, useRef, useState } from "react";
import type { RpContext } from "@worldcoin/idkit";
import { WorldWidget } from "./world-widget";
import type { Proposal } from "@/shared/domain";
import { apiFetch, apiPost } from "./api-client";
export type WorldStatus = {
  required: boolean;
  enrolled: boolean;
  configured: boolean;
  mode: string;
  authMode: "world" | "local-demo";
};
export type WorldRequest =
  | { purpose: "proposal" | "delegation"; proposalId: string }
  | {
      purpose: "setup";
      paymentProposalId: string;
      investmentProposalId: string;
    }
  | {
      purpose: "change";
      change: { baseVersion: number; conditions: Proposal["conditions"] };
    };
type Policy = {
  baseVersion: number;
  accountId: string;
  agentId: string;
  scopes: string[];
  conditions: Proposal["conditions"] | { mailIds: string[] };
  investmentConditions?: Proposal["conditions"];
  investmentBaseVersion?: number;
  target: {
    recipient: string;
    investment: {
      mode: string;
      chainId: number;
      protocol: string;
      token: string;
      pool: string;
    };
  };
};
export type Challenge = {
  id: string;
  appId: `app_${string}`;
  rpContext: RpContext;
  environment: "production" | "sandbox";
  flow?: "session" | "request";
  action?: string;
  signal: string;
  sessionId?: `session_${string}`;
  policy?: Policy;
};
type DemoChallenge = { id: string; policy: Policy; expiresAt: number };
export function WorldApproval({
  input,
  onApproved,
  onCancel,
}: {
  input: WorldRequest;
  onApproved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [world, setWorld] = useState<WorldStatus>();
  const [challenge, setChallenge] = useState<Challenge & { attempt: number }>();
  const [demo, setDemo] = useState<DemoChallenge>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const pendingId = useRef<string | undefined>(undefined);
  const completed = useRef(false);
  const finishing = useRef(false);
  const pendingDemoId = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void apiFetch("/api/world")
      .then(async (response) => {
        if (!response.ok) throw new Error("World設定を取得できませんでした。");
        const status: WorldStatus = await response.json();
        if (!active) return;
        setWorld(status);
        if (!status.configured || !status.enrolled) {
          setError("Worldが未設定または未登録です。");
          return;
        }
        const result = await apiPost("/api/world", { action: "begin", input });
        if (active) {
          pendingId.current = result.id;
          setChallenge({ ...result, attempt: generation.current });
        } else await apiPost("/api/world", { action: "cancel", id: result.id });
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
      generation.current++;
      if (pendingDemoId.current && !completed.current)
        void apiPost("/api/demo/approvals", {
          action: "cancel",
          id: pendingDemoId.current,
        }).catch(() =>
          console.warn(
            "Demo cancellation could not be confirmed; the challenge expires after five minutes.",
          ),
        );
      if (pendingId.current && !completed.current)
        void apiPost("/api/world", {
          action: "cancel",
          id: pendingId.current,
        }).catch(() =>
          console.warn(
            "World cancellation could not be confirmed; the challenge expires after five minutes.",
          ),
        );
    };
  }, [input]);
  async function cancel() {
    generation.current++;
    setBusy(true);
    try {
      if (demo)
        await apiPost("/api/demo/approvals", { action: "cancel", id: demo.id });
      if (challenge)
        await apiPost("/api/world", { action: "cancel", id: challenge.id });
      setOpen(false);
      onCancel();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function startDemo() {
    const attempt = ++generation.current;
    setOpen(false);
    setBusy(true);
    setError("");
    try {
      const result = await apiPost("/api/demo/approvals", {
        action: "begin",
        input,
      });
      if (attempt !== generation.current) {
        await apiPost("/api/demo/approvals", {
          action: "cancel",
          id: result.id,
        });
        return;
      }
      pendingDemoId.current = result.id;
      setDemo(result);
      pendingId.current = undefined;
      setChallenge(undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const policy = demo?.policy ?? challenge?.policy;
  const conditions = policy?.conditions;
  const c = conditions && "id" in conditions ? conditions : undefined;
  const investment = policy?.investmentConditions;
  const names: Record<string, string> = {
    read: "業務データ参照",
    propose: "条件の提案",
    mail: "指定メールの閲覧",
    payment: "承認条件内の支払い",
    investment: "承認条件内の運用",
    redemption: "本人依頼に基づく償還",
  };
  return (
    <section className="panel approval-policy" aria-label="World承認">
      <h2>この内容を承認</h2>
      <p>銀行が保存した対象と条件を確認してください。承認後に反映されます。</p>
      {((c?.id === "investment" && c.enabled) || investment?.enabled) && (
        <p>承認すると、条件内の余力をAaveへ預け入れます。</p>
      )}
      {policy && (
        <div className="card">
          <p>
            口座：{policy.accountId} / 対象Agent：{policy.agentId}
          </p>
          <p>
            許可する操作：{policy.scopes.map((s) => names[s] ?? s).join("・")}
          </p>
          {conditions && "mailIds" in conditions && (
            <p>
              閲覧範囲：
              {conditions.mailIds
                .map((id) =>
                  id === "aoba-mail"
                    ? "アオバデザインのサンプルメール"
                    : id === "sakura-mail"
                      ? "サクラオフィスのサンプルメール"
                      : id,
                )
                .join("・")}
            </p>
          )}
          {c && (
            <>
              <p>
                {c.enabled ? "有効にする" : "停止する"} · 第
                {policy.baseVersion + 1}版
              </p>
              {c.id === "payment" && (
                <>
                  <p>
                    支払先：
                    {(c.paymentRecipients ?? [{ recipientId: c.recipientId }])
                      .map((r) =>
                        r.recipientId === "aoba"
                          ? "アオバデザイン"
                          : "サクラオフィス",
                      )
                      .join("・")}
                  </p>
                  <p className="hash">{policy.target.recipient}</p>
                  {(
                    c.paymentRecipients ?? [
                      {
                        recipientId: c.recipientId,
                        maxPaymentJpy: c.maxPaymentJpy,
                        monthlyLimitJpy: c.monthlyLimitJpy,
                      },
                    ]
                  ).map((r) => (
                    <p key={r.recipientId}>
                      {r.recipientId === "aoba"
                        ? "アオバデザイン"
                        : "サクラオフィス"}
                      ：1件 ¥{r.maxPaymentJpy} / 月合計：¥{r.monthlyLimitJpy} ·
                      期日払い
                    </p>
                  ))}
                </>
              )}
              <p>
                最低残高：¥{c.minimumBalanceJpy} / 予備資金：¥
                {c.safetyBufferJpy}
              </p>
              {c.id === "investment" && (
                <>
                  <p>1回の運用上限：¥{c.maxInvestmentJpy}</p>
                  <p>
                    運用先：{policy.target.investment.protocol} ·{" "}
                    {policy.target.investment.mode === "stub"
                      ? "模擬運用"
                      : `Chain ${policy.target.investment.chainId}`}
                  </p>
                  <p className="hash">
                    Pool: {policy.target.investment.pool}
                    <br />
                    Token: {policy.target.investment.token}
                  </p>
                </>
              )}
            </>
          )}
          {investment && (
            <div className="card">
              <h3>
                余力の自動運用 · 第{(policy.investmentBaseVersion ?? 0) + 1}版
              </h3>
              <p>
                1回の運用上限：¥{investment.maxInvestmentJpy} / 予備資金：¥
                {investment.safetyBufferJpy} / 最低残高：¥
                {investment.minimumBalanceJpy}
              </p>
              <p>
                運用先：{policy.target.investment.protocol} ·{" "}
                {policy.target.investment.mode === "stub"
                  ? "模擬運用"
                  : `Chain ${policy.target.investment.chainId}`}
              </p>
              <p className="hash">
                Pool: {policy.target.investment.pool}
                <br />
                Token: {policy.target.investment.token}
              </p>
            </div>
          )}
        </div>
      )}
      <div className="approval-actions">
        {challenge && !demo && (
          <>
            <p>
              確認期限：
              {new Date(
                challenge.rpContext.expires_at * 1000,
              ).toLocaleTimeString("ja-JP")}
            </p>
            <button
              disabled={busy || open || !!error}
              onClick={() => setOpen(true)}
            >
              Worldで確認して承認
            </button>
            <WorldWidget
              challenge={challenge}
              open={open}
              onOpenChange={(value) => {
                setOpen(value);
                if (!value && !completed.current && !finishing.current) {
                  generation.current++;
                  void apiPost("/api/world", {
                    action: "cancel",
                    id: challenge.id,
                  }).catch((e) => setError(String(e)));
                  setError("World確認を閉じました。設定は未反映です。");
                }
              }}
              description="表示した権限と条件の承認"
              handleVerify={async (proof) => {
                const attempt = challenge.attempt;
                if (attempt !== generation.current) return;
                finishing.current = true;
                setBusy(true);
                try {
                  await apiPost(
                    "/api/world",
                    {
                      action: "verify",
                      id: challenge.id,
                      proof,
                    },
                    120000,
                  );
                  if (attempt !== generation.current) return;
                  completed.current = true;
                  setOpen(false);
                  await onApproved();
                } catch (e) {
                  if (attempt === generation.current)
                    setError(
                      "結果を確認できませんでした。チャットと実行記録を確認してください。",
                    );
                  throw e;
                } finally {
                  finishing.current = false;
                  if (attempt === generation.current) setBusy(false);
                }
              }}
              onError={(code, report) => {
                // Identifiers only; the report payloads can carry proofs.
                console.warn("World IDKit error", code, {
                  requestId: report?.request_id,
                  sdk: report?.package_version,
                  at: report?.generated_at,
                });
                setError(
                  `Worldで確認できませんでした（${code}）。新しい確認またはデモ継続を選んでください。`,
                );
              }}
            />
          </>
        )}
        {world?.authMode === "local-demo" && !demo && (
          <button disabled={busy} onClick={() => void startDemo()}>
            デモとして続ける
          </button>
        )}
        {demo && (
          <>
            <p>
              デモ承認：World本人確認を省略します。確認期限：
              {new Date(demo.expiresAt * 1000).toLocaleTimeString("ja-JP")}
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                const attempt = generation.current;
                setBusy(true);
                setError("");
                try {
                  await apiPost(
                    "/api/demo/approvals",
                    {
                      action: "confirm",
                      id: demo.id,
                    },
                    120000,
                  );
                  if (attempt !== generation.current) return;
                  completed.current = true;
                  await onApproved();
                } catch (e) {
                  if (attempt === generation.current) setError(String(e));
                } finally {
                  if (attempt === generation.current) setBusy(false);
                }
              }}
            >
              {busy
                ? (c?.id === "investment" && c.enabled) || investment?.enabled
                  ? "承認・運用開始中…"
                  : "承認中…"
                : "この内容をデモ承認"}
            </button>
          </>
        )}
        <button disabled={busy} onClick={() => void cancel()}>
          キャンセル
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
