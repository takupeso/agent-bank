"use client";
import { apiFetch, apiPost } from "../api-client";
import { WorldApproval, type WorldRequest } from "../world-approval";
import { useEffect, useState } from "react";
import type { Rule } from "@/shared/domain";
type RuleView = Rule & {
  status: "active" | "stopped" | "reapproval-required";
  investmentTarget: { protocol: string; mode: string; chainId: number } | null;
};
type Grant = {
  id: string;
  status: string;
  mailIds: string[];
  authorization: { scopes: string[]; agentId: string; approvalMethod: string };
};
const tabs = [
  {
    id: "data",
    label: "Data access",
    description: "Review the information the agent can access.",
  },
  {
    id: "payment",
    label: "Deposit operations",
    description: "Review who can be paid, how much, and when.",
  },
  {
    id: "investment",
    label: "Token operations",
    description: "Review investment limits and approved destinations.",
  },
] as const;
type Tab = (typeof tabs)[number]["id"];
const yen = (value: string) => `¥${BigInt(value).toLocaleString("en-US")}`;
const recipientName = (id: string) =>
  id === "aoba" ? "Aoba Design" : id === "sakura" ? "Sakura Office" : id;
function paymentRecipients(rule: Rule) {
  return (
    rule.paymentRecipients ?? [
      {
        recipientId: rule.recipientId as "aoba" | "sakura",
        maxPaymentJpy: rule.maxPaymentJpy,
        monthlyLimitJpy: rule.monthlyLimitJpy,
      },
    ]
  );
}
export default function Rules() {
  const [tab, setTab] = useState<Tab>("data");
  const [rules, setRules] = useState<RuleView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RuleView>>({});
  const [grants, setGrants] = useState<Grant[]>([]);
  const [approval, setApproval] = useState<{ input: WorldRequest }>();
  const [error, setError] = useState("");
  async function load() {
    try {
      const [r, g] = await Promise.all([
        apiFetch("/api/rules"),
        apiFetch("/api/delegations"),
      ]);
      if (!r.ok || !g.ok) throw new Error("Unable to load settings.");
      setRules(await r.json());
      setGrants(await g.json());
      setDrafts({});
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("agent-bank:rules-updated", refresh);
    return () =>
      window.removeEventListener("agent-bank:rules-updated", refresh);
  }, []);
  function save(rule: RuleView) {
    const {
      version,
      consentId,
      worldApprovalId,
      authorization,
      status,
      investmentTarget,
      ...conditions
    } = rule;
    void consentId;
    void worldApprovalId;
    void authorization;
    void status;
    void investmentTarget;
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
  function edit(rule: RuleView, patch: Partial<RuleView>) {
    setDrafts((current) => ({ ...current, [rule.id]: { ...rule, ...patch } }));
  }
  function changePaymentLimit(
    rule: RuleView,
    recipientIndex: number,
    key: "maxPaymentJpy" | "monthlyLimitJpy",
    value: string,
  ) {
    const recipients = paymentRecipients(rule).map((recipient, index) =>
      index === recipientIndex ? { ...recipient, [key]: value } : recipient,
    );
    edit(rule, {
      paymentRecipients: recipients,
      ...(recipientIndex === 0
        ? {
            recipientId: recipients[0].recipientId,
            maxPaymentJpy: recipients[0].maxPaymentJpy,
            monthlyLimitJpy: recipients[0].monthlyLimitJpy,
          }
        : {}),
    });
  }
  const visibleRules = rules.filter((rule) => rule.id === tab);
  const visibleGrants = grants.filter((grant) =>
    grant.authorization.scopes.some((scope) =>
      tab === "data"
        ? ["mail", "read", "propose"].includes(scope)
        : tab === "payment"
          ? scope === "payment"
          : ["investment", "redemption"].includes(scope),
    ),
  );
  return (
    <>
      <header className="page-header">
        <h1>Automation rules</h1>
        <p>Review what the agent can do and the approved terms.</p>
      </header>
      <div className="rules-tabs" role="tablist" aria-label="Rule categories">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`rules-tab-${item.id}`}
            aria-controls={`rules-panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            disabled={!!approval}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              setTab(tabs[next].id);
              document.getElementById(`rules-tab-${tabs[next].id}`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`rules-panel-${tab}`}
        aria-labelledby={`rules-tab-${tab}`}
        tabIndex={0}
      >
        <p className="rules-intro">
          {tabs.find((item) => item.id === tab)!.description}
        </p>
        {visibleRules.map((saved) => {
          const r = drafts[saved.id] ?? saved;
          return (
            <section className="panel rule-settings" key={saved.id}>
              <span
                className={`badge ${saved.status === "active" && saved.enabled ? "active" : "paused"}`}
              >
                {saved.status === "reapproval-required"
                  ? "Awaiting reapproval"
                  : saved.enabled
                    ? "Active"
                    : "Paused"}{" "}
                · Version {saved.version}
              </span>
              <h2>
                {saved.id === "payment"
                  ? "Automatic payments"
                  : "Automatic investing"}
              </h2>
              <div className="approved-rule-summary">
                {saved.id === "payment" ? (
                  paymentRecipients(saved).map((recipient) => (
                    <section
                      className="rule-recipient"
                      key={recipient.recipientId}
                    >
                      <h3>{recipientName(recipient.recipientId)}</h3>
                      <dl className="rule-facts">
                        <div>
                          <dt>Per-payment limit</dt>
                          <dd>{yen(recipient.maxPaymentJpy)}</dd>
                        </div>
                        <div>
                          <dt>Monthly limit</dt>
                          <dd>{yen(recipient.monthlyLimitJpy)}</dd>
                        </div>
                        <div>
                          <dt>Payment date</dt>
                          <dd>Invoice due date</dd>
                        </div>
                      </dl>
                    </section>
                  ))
                ) : (
                  <dl className="rule-facts">
                    <div>
                      <dt>Destination</dt>
                      <dd>
                        {saved.investmentTarget
                          ? saved.investmentTarget.mode === "stub"
                            ? "Aave (simulation)"
                            : saved.investmentTarget.protocol
                          : "Confirm when approving again"}
                      </dd>
                    </div>
                    {saved.investmentTarget?.mode === "sepolia" && (
                      <div>
                        <dt>Network</dt>
                        <dd>
                          {saved.investmentTarget.chainId === 84532
                            ? "Base Sepolia"
                            : `Chain ${saved.investmentTarget.chainId}`}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Investment asset</dt>
                      <dd>
                        {saved.investmentTarget?.mode === "sepolia"
                          ? "Test USDC"
                          : saved.investmentTarget
                            ? "USDC (simulation)"
                            : "Confirm when approving again"}
                      </dd>
                    </div>
                    <div>
                      <dt>Investment limit per transaction</dt>
                      <dd>{yen(saved.maxInvestmentJpy)}</dd>
                    </div>
                    <div>
                      <dt>Safety buffer</dt>
                      <dd>{yen(saved.safetyBufferJpy)}</dd>
                    </div>
                  </dl>
                )}
                <dl className="rule-facts">
                  <div>
                    <dt>Minimum balance</dt>
                    <dd>{yen(saved.minimumBalanceJpy)}</dd>
                  </div>
                </dl>
              </div>
              <details className="rule-editor">
                <summary>Edit settings</summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    save(r);
                  }}
                >
                  {r.id === "payment" &&
                    paymentRecipients(r).map((recipient, recipientIndex) => (
                      <fieldset
                        className="payment-recipient-fields"
                        key={recipient.recipientId}
                      >
                        <legend>{recipientName(recipient.recipientId)}</legend>
                        {(["maxPaymentJpy", "monthlyLimitJpy"] as const).map(
                          (key) => (
                            <label className="field" key={key}>
                              {key === "maxPaymentJpy"
                                ? "Payment limit per transaction (JPY)"
                                : "Monthly payment limit (JPY)"}
                              <input
                                inputMode="numeric"
                                value={recipient[key]}
                                onChange={(event) =>
                                  changePaymentLimit(
                                    r,
                                    recipientIndex,
                                    key,
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          ),
                        )}
                      </fieldset>
                    ))}
                  {(r.id === "payment"
                    ? (["minimumBalanceJpy"] as const)
                    : ([
                        "maxInvestmentJpy",
                        "safetyBufferJpy",
                        "minimumBalanceJpy",
                      ] as const)
                  ).map((key) => (
                    <label className="field" key={key}>
                      {
                        {
                          maxInvestmentJpy:
                            "Investment limit per transaction (JPY)",
                          safetyBufferJpy: "Safety buffer (JPY)",
                          minimumBalanceJpy: "Minimum balance (JPY)",
                        }[key]
                      }
                      <input
                        inputMode="numeric"
                        value={r[key]}
                        onChange={(event) =>
                          edit(r, { [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                  <button disabled={!!approval}>Save changes</button>
                </form>
              </details>
              <div className="quick-actions">
                <button
                  type="button"
                  disabled={!!approval}
                  onClick={() =>
                    saved.enabled && saved.status !== "reapproval-required"
                      ? void stop(saved)
                      : save({ ...saved, enabled: true })
                  }
                >
                  {saved.status === "reapproval-required"
                    ? "Approve again"
                    : saved.enabled
                      ? "Pause"
                      : "Enable"}
                </button>
              </div>
            </section>
          );
        })}
        {tab !== "data" && !visibleRules.length && (
          <section className="panel">
            <h2>
              {tab === "payment"
                ? "No payment settings"
                : "No investment settings"}
            </h2>
            <p>
              Settings appear here after you approve the terms in the AI chat.
            </p>
          </section>
        )}
        {visibleGrants.map((g) => (
          <section className="panel permission-summary" key={g.id}>
            <span
              className={`badge ${g.status === "active" ? "active" : "paused"}`}
            >
              {g.status === "active"
                ? "Approved"
                : g.status === "revoked"
                  ? "Revoked"
                  : "Awaiting reapproval"}
            </span>
            <h2>
              {tab === "data" ? "Accessible information" : "Agent permissions"}
            </h2>
            {tab === "data" ? (
              <>
                {g.authorization.scopes.includes("mail") && (
                  <section>
                    <h3>Emails and attached invoices</h3>
                    <ul>
                      {g.mailIds.map((id) => (
                        <li key={id}>
                          {id === "aoba-mail"
                            ? "Aoba Design emails and invoices"
                            : id === "sakura-mail"
                              ? "Sakura Office emails and invoices"
                              : id}
                        </li>
                      ))}
                    </ul>
                    <p>Access is limited to the selected emails.</p>
                  </section>
                )}
                {g.authorization.scopes.includes("read") && (
                  <section>
                    <h3>Account and transaction information</h3>
                    <ul>
                      <li>Deposit balance and automation rules</li>
                      {g.authorization.scopes.includes("mail") && (
                        <li>
                          Invoices, investment plans, and execution records
                          based on authorized emails
                        </li>
                      )}
                    </ul>
                  </section>
                )}
                {g.authorization.scopes.includes("propose") && (
                  <p>
                    The agent can propose payment and investment terms using
                    accessible information.
                  </p>
                )}
              </>
            ) : (
              <>
                {g.authorization.scopes.includes("payment") && (
                  <p>The agent can pay invoices within active rules.</p>
                )}
                {g.authorization.scopes.includes("investment") && (
                  <p>The agent can invest within active rules.</p>
                )}
                {g.authorization.scopes.includes("redemption") && (
                  <p>Invested funds are redeemed at your request.</p>
                )}
              </>
            )}
            {g.status !== "active" && (
              <p>This permission does not currently allow any actions.</p>
            )}
            <button
              disabled={g.status === "revoked" || !!approval}
              onClick={async () => {
                try {
                  await apiPost(
                    `/api/delegations/${encodeURIComponent(g.id)}/revoke`,
                    {},
                  );
                  setError("");
                  await load();
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Revoke permission
            </button>
          </section>
        ))}
        {tab === "data" && !visibleGrants.length && (
          <section className="panel">
            <h2>No access permissions</h2>
            <p>
              Request email access in the AI chat, review the selected emails,
              and approve.
            </p>
          </section>
        )}
      </section>
      {approval && (
        <WorldApproval
          input={approval.input}
          onCancel={() => {
            setApproval(undefined);
            void load();
            setError("Approval cancelled. Settings have not changed.");
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
