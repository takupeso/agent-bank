"use client";
import { apiFetch, apiPost } from "../api-client";
import { WorldApproval, type WorldRequest } from "../world-approval";
import { useEffect, useState } from "react";
import type { Rule } from "@/shared/domain";
type RuleView = Rule & { status: "active" | "stopped" | "reapproval-required" };
type Grant = {
  id: string;
  status: string;
  authorization: { scopes: string[]; agentId: string; approvalMethod: string };
};
export default function Rules() {
  const [rules, setRules] = useState<RuleView[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [approval, setApproval] = useState<{
    input: WorldRequest;
  }>();
  const [error, setError] = useState("");
  async function load() {
    const [r, g] = await Promise.all([
      apiFetch("/api/rules"),
      apiFetch("/api/delegations"),
    ]);
    if (r.ok) setRules(await r.json());
    if (g.ok) setGrants(await g.json());
  }
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("agent-bank:rules-updated", refresh);
    return () =>
      window.removeEventListener("agent-bank:rules-updated", refresh);
  }, []);
  async function save(rule: RuleView) {
    const {
      version,
      consentId,
      worldApprovalId,
      authorization,
      status,
      ...conditions
    } = rule;
    void consentId;
    void worldApprovalId;
    void authorization;
    void status;
    setApproval({
      input: {
        purpose: "change",
        change: { baseVersion: version, conditions },
      },
    });
  }
  async function stop(rule: Rule) {
    try {
      await apiPost(`/api/rules/${rule.id}/disable`, {});
      setError("");
      await load();
    } catch (e) {
      setError(String(e));
    }
  }
  function changePaymentLimit(
    ruleIndex: number,
    recipientIndex: number,
    key: "maxPaymentJpy" | "monthlyLimitJpy",
    value: string,
  ) {
    setRules(
      rules.map((rule, index) => {
        if (index !== ruleIndex) return rule;
        const recipients = rule.paymentRecipients ?? [
          {
            recipientId: rule.recipientId as "aoba" | "sakura",
            maxPaymentJpy: rule.maxPaymentJpy,
            monthlyLimitJpy: rule.monthlyLimitJpy,
          },
        ];
        const paymentRecipients = recipients.map((recipient, currentIndex) =>
          currentIndex === recipientIndex
            ? { ...recipient, [key]: value }
            : recipient,
        );
        return {
          ...rule,
          paymentRecipients,
          ...(recipientIndex === 0
            ? {
                recipientId: paymentRecipients[0].recipientId,
                maxPaymentJpy: paymentRecipients[0].maxPaymentJpy,
                monthlyLimitJpy: paymentRecipients[0].monthlyLimitJpy,
              }
            : {}),
        };
      }),
    );
  }
  return (
    <>
      <header>
        <h1>自動実行ルール</h1>
        <p>あなたが同意した条件で、Agentが動きます。</p>
      </header>
      {rules.map((r, index) => (
        <section className="panel" key={r.id}>
          <span className="badge">
            {r.status === "reapproval-required"
              ? "再承認待ち"
              : r.enabled
                ? "有効"
                : "停止中"}{" "}
            · 第{r.version}版
          </span>
          <h2>
            {r.id === "payment"
              ? `自動支払い（${r.paymentRecipients?.map((recipient) => (recipient.recipientId === "aoba" ? "アオバデザイン" : "サクラオフィス")).join("・") ?? "アオバデザイン"}）`
              : "余力の自動運用"}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(r);
            }}
          >
            {r.id === "payment" &&
              (
                r.paymentRecipients ?? [
                  {
                    recipientId: r.recipientId as "aoba" | "sakura",
                    maxPaymentJpy: r.maxPaymentJpy,
                    monthlyLimitJpy: r.monthlyLimitJpy,
                  },
                ]
              ).map((recipient, recipientIndex) => (
                <div
                  className="payment-recipient-fields"
                  key={recipient.recipientId}
                >
                  <h3>
                    {recipient.recipientId === "aoba"
                      ? "アオバデザイン"
                      : "サクラオフィス"}
                  </h3>
                  {(["maxPaymentJpy", "monthlyLimitJpy"] as const).map(
                    (key) => (
                      <label className="field" key={key}>
                        {key === "maxPaymentJpy"
                          ? "1件の支払上限（円）"
                          : "月合計の支払上限（円）"}
                        <input
                          inputMode="numeric"
                          value={recipient[key]}
                          onChange={(e) =>
                            changePaymentLimit(
                              index,
                              recipientIndex,
                              key,
                              e.target.value,
                            )
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
              ))}
            {(r.id === "payment"
              ? ["minimumBalanceJpy"]
              : ["maxInvestmentJpy", "safetyBufferJpy", "minimumBalanceJpy"]
            ).map((key) => (
              <label className="field" key={key}>
                {
                  (
                    {
                      maxInvestmentJpy: "1回の運用上限（円）",
                      safetyBufferJpy: "予備資金（円）",
                      minimumBalanceJpy: "最低残高（円）",
                    } as Record<string, string>
                  )[key]
                }
                <input
                  inputMode="numeric"
                  value={r[key as keyof Rule] as string}
                  onChange={(e) =>
                    setRules(
                      rules.map((v, i) =>
                        i === index ? { ...v, [key]: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <div className="quick-actions">
              <button disabled={!!approval}>変更を保存</button>
              <button
                type="button"
                disabled={!!approval}
                onClick={() =>
                  r.enabled && r.status !== "reapproval-required"
                    ? void stop(r)
                    : void save({ ...r, enabled: true })
                }
              >
                {r.status === "reapproval-required"
                  ? "再承認する"
                  : r.enabled
                    ? "停止する"
                    : "有効にする"}
              </button>
            </div>
          </form>
        </section>
      ))}
      {!rules.length && (
        <section className="panel">
          AIチャットで条件に同意すると、ここに設定が表示されます。
        </section>
      )}
      <section className="panel">
        <h2>Agentへの許可</h2>
        {grants.length ? (
          grants.map((g) => (
            <div className="card" key={g.id}>
              <p>対象Agent：{g.authorization.agentId}</p>
              <p>
                操作：
                {g.authorization.scopes
                  .map(
                    (scope) =>
                      ({
                        read: "業務データ参照",
                        propose: "条件の提案",
                        mail: "指定メールの閲覧",
                        payment: "承認条件内の支払い",
                        investment: "承認条件内の運用",
                        redemption: "本人依頼に基づく償還",
                      })[scope] ?? scope,
                  )
                  .join("・")}
              </p>
              <p>
                {g.status === "active"
                  ? "許可済み（自動実行には有効なルールも必要）"
                  : g.status === "revoked"
                    ? "取消済み"
                    : "再承認待ち"}{" "}
                ·{" "}
                {g.authorization.approvalMethod === "local-demo"
                  ? "デモ承認（World省略）"
                  : g.authorization.approvalMethod === "human-confirmation"
                    ? "画面で確認"
                  : "World確認"}
              </p>
              <button
                disabled={g.status === "revoked"}
                onClick={async () => {
                  try {
                    await apiPost(
                      `/api/delegations/${encodeURIComponent(g.id)}/revoke`,
                      {},
                    );
                    await load();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                許可を取り消す
              </button>
            </div>
          ))
        ) : (
          <p>許可はありません。</p>
        )}
      </section>
      {approval && (
        <WorldApproval
          input={approval.input}
          onCancel={() => {
            setApproval(undefined);
            void load();
            setError("承認をキャンセルしました。設定は変更されていません。");
          }}
          onApproved={async () => {
            setApproval(undefined);
            setError("");
            await load();
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
