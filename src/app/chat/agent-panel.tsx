"use client";
import { apiFetch, apiPost } from "../api-client";
import { WorldApproval, type WorldRequest } from "../world-approval";
import { DemoEvent } from "./demo-event";
import { Conditions, ProposalCard } from "./rule-card";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Message, Invoice, Mail, Proposal, Rule } from "@/shared/domain";
const journey = [
  "Email access",
  "Approve terms",
  "Auto-pay",
  "Invest",
  "Redeem",
] as const;
function journeyProgress(messages: Message[]) {
  const has = (test: (m: Message) => boolean) => messages.some(test);
  const lastInvested = messages.findLastIndex(
    (m) => m.kind === "execution" && m.text.startsWith("Started investing"),
  );
  const lastRedeemed = messages.findLastIndex((m) =>
    m.text.startsWith("Investments redeemed"),
  );
  return [
    has((m) => m.kind === "invoices"),
    has((m) => m.kind === "rule"),
    has((m) => m.text.startsWith("Paid ¥")),
    lastInvested >= 0,
    lastInvested >= 0 && lastRedeemed > lastInvested,
  ];
}
export function AgentPanel() {
  const conversation = useRef<HTMLElement>(null);
  const tools = useRef<HTMLDetailsElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [approval, setApproval] = useState<{
    input: WorldRequest;
    text: string;
  }>();
  const [mailPermission, setMailPermission] = useState<{
    proposalId: string;
    text: string;
    mailIds: string[];
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch("/api/chat/messages").then(async (r) => {
      if (r.ok) setMessages(await r.json());
      setLoaded(true);
    });
  }, []);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = conversation.current;
      container?.scrollTo({
        top: container.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, pendingText]);
  async function send(value: string) {
    const proposalId = (
      messages.filter((m) => m.kind === "proposal").at(-1)?.data?.proposal as
        | Proposal
        | undefined
    )?.id;
    const startedAt = Date.now();
    setPendingText(value);
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          proposalId,
        }),
      });
      if (!r.ok)
        throw new Error(
          "Unable to complete the operation. Check your settings and execution records.",
        );
      const remainingDelay = 1000 - (Date.now() - startedAt);
      if (remainingDelay > 0)
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      const next: Message[] = await r.json();
      setMessages(next);
      const last = next.at(-1);
      setApproval(
        last?.kind === "approval-request"
          ? { input: last.data?.input as WorldRequest, text: value }
          : undefined,
      );
      setMailPermission(
        last?.kind === "mail-permission-request"
          ? {
              proposalId: last.data?.proposalId as string,
              mailIds: last.data?.mailIds as string[],
              text: value,
            }
          : undefined,
      );
      window.dispatchEvent(new Event("agent-bank:invoices-updated"));
      setText("");
    } catch (e) {
      setError(String(e));
    } finally {
      setPendingText("");
      setBusy(false);
    }
  }
  function hasUnacceptedProposal(kind: Proposal["kind"]) {
    let proposalIndex = -1;
    let ruleIndex = -1;
    messages.forEach((m, index) => {
      if (
        m.kind === "proposal" &&
        (m.data?.proposal as Proposal | undefined)?.kind === kind
      )
        proposalIndex = index;
      if (m.kind === "rule" && (m.data?.rule as Rule | undefined)?.id === kind)
        ruleIndex = index;
    });
    return proposalIndex > ruleIndex;
  }
  const progress = journeyProgress(messages);
  const current = progress.indexOf(false);
  const locked = busy || !!approval || !!mailPermission;
  const refreshMessages = () => {
    window.dispatchEvent(new Event("agent-bank:invoices-updated"));
    apiFetch("/api/chat/messages").then(async (r) => {
      if (r.ok) setMessages(await r.json());
    });
  };
  const nextStep = !loaded
    ? undefined
    : current === 0
      ? {
          label: "Allow email access",
          hint: "The agent reads only the sample emails you approve.",
          run: () =>
            send("I allow access to my emails. Please check the invoices."),
        }
      : current === 1 && hasUnacceptedProposal("payment")
        ? {
            label: "Review and approve terms",
            hint: "Approve payment and investment limits in one step.",
            run: () => send("Confirm these settings"),
          }
        : current === 2
          ? { label: "Simulate the payment due date", hint: "", run: undefined }
          : current === 3
            ? {
                label: "Invest available funds",
                hint: "Funds for payments and the safety buffer stay put.",
                run: () => send("Invest my available funds"),
              }
            : current === 4
              ? {
                  label: "Redeem investments",
                  hint: "Return invested funds to your deposit account.",
                  run: () => send("Redeem all investments to TD"),
                }
              : undefined;
  return (
    <aside id="agent-panel" className="agent-panel" aria-label="Agent chat">
      <header className="agent-panel-header">
        <span className="agent-avatar" aria-hidden="true" />
        <div>
          <h2>Agent</h2>
          <p>
            <span className="agent-status" aria-hidden="true" />
            Acts only within the terms you approve
          </p>
        </div>
      </header>
      <ol
        className={"agent-journey" + (loaded ? "" : " loading")}
        aria-label="Demo progress"
      >
        {journey.map((step, index) => (
          <li
            key={step}
            className={
              progress[index] ? "done" : index === current ? "current" : ""
            }
            aria-current={index === current ? "step" : undefined}
          >
            <span aria-hidden="true">{progress[index] ? "✓" : index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <section
        ref={conversation}
        className="agent-conversation"
        aria-live="polite"
      >
        {messages.map((m) => (
          <article
            className={"message " + m.role + (m.kind ? " kind-" + m.kind : "")}
            key={m.id}
          >
            <small>{m.role === "user" ? "You" : "Agent"}</small>
            <p>
              {m.text
                .replace(
                  /^¥([\d,]+) locked in the reserve account; [\d,.]+ test USDC equivalent invested in (Aave on Sepolia|simulation)\.$/,
                  (_, amount: string, destination: string) =>
                    `Started investing ¥${amount} from your deposit account in Aave.${destination === "simulation" ? " (Simulation)" : ""}`,
                )
                .replace(
                  /^¥([\d,]+)を別段口座にlockし、[\d,.]+擬似USDC相当を(SepoliaのAaveで運用しました|模擬運用しました)。$/,
                  (_, amount: string, destination: string) =>
                    `Started investing ¥${amount} from your deposit account in Aave.${destination === "模擬運用しました" ? " (Simulation)" : ""}`,
                )}
            </p>
            {m.kind === "invoices" &&
              (m.data?.invoices as Invoice[]).map((i) => {
                const mail = (m.data?.emails as Mail[] | undefined)?.find(
                  (item) => item.id === i.emailId,
                );
                return (
                  <div className="card" key={i.id}>
                    <b>{i.issuer}</b>
                    <p>
                      ¥{BigInt(i.amountJpy).toLocaleString("en-US")} · Due date{" "}
                      {new Date(i.dueAt).toLocaleString("en-US", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </p>
                    {mail && (
                      <details>
                        <summary>View source email</summary>
                        <p>
                          {mail.sender} · {mail.subject}
                        </p>
                        <p>{mail.body}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            {m.kind === "proposal" && (
              <ProposalCard
                proposal={m.data?.proposal as Proposal}
                snapshot={
                  m.data?.snapshot as Record<string, string> | undefined
                }
              />
            )}
            {m.kind === "rule" && (
              <div className="card">
                <b>Approval</b>
                <Conditions rule={m.data?.rule as Rule} />
              </div>
            )}
          </article>
        ))}
        {pendingText && (
          <article className="message user pending-message">
            <small>You</small>
            <p>{pendingText}</p>
          </article>
        )}
        {busy && (
          <article
            className="message agent typing-indicator"
            role="status"
            aria-label="Agent is preparing a reply"
          >
            <small>Agent</small>
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </article>
        )}
      </section>
      {nextStep && (
        <div className="agent-next">
          <div>
            <span>Next step</span>
            {nextStep.hint && <p>{nextStep.hint}</p>}
          </div>
          {nextStep.run ? (
            <button
              type="button"
              aria-label={`Next step: ${nextStep.label}`}
              disabled={locked}
              onClick={() => {
                setError("");
                void nextStep.run!();
              }}
            >
              {nextStep.label}
            </button>
          ) : (
            <DemoEvent
              onError={setError}
              type="due_date_reached"
              label={nextStep.label}
              onComplete={refreshMessages}
            />
          )}
        </div>
      )}
      <details ref={tools} className="agent-tools">
        <summary>Demo actions and common requests</summary>
        <div
          className="quick-actions"
          onClick={(event) => {
            if (
              (event.target as HTMLElement).closest("button") &&
              tools.current
            ) {
              tools.current.open = false;
              setError("");
            }
          }}
        >
          <button
            disabled={busy || !!approval || !!mailPermission}
            onClick={() =>
              send("I allow access to my emails. Please check the invoices.")
            }
          >
            I allow access to my emails. Please check the invoices.
          </button>
          <button
            disabled={
              busy ||
              !!approval ||
              !!mailPermission ||
              !hasUnacceptedProposal("payment")
            }
            onClick={() => send("Confirm these settings")}
          >
            Confirm payment setup
          </button>
          <DemoEvent
            onError={setError}
            type="due_date_reached"
            label="Demo: advance to payment due date"
            onComplete={() => {
              window.dispatchEvent(new Event("agent-bank:invoices-updated"));
              apiFetch("/api/chat/messages").then(async (r) => {
                if (r.ok) {
                  setMessages(await r.json());
                }
              });
            }}
          />
          <button
            disabled={busy || !!approval || !!mailPermission}
            onClick={() => send("Invest my available funds")}
          >
            Invest my available funds
          </button>
          <button
            disabled={
              busy ||
              !!approval ||
              !!mailPermission ||
              !hasUnacceptedProposal("investment")
            }
            onClick={() => send("Confirm these settings")}
          >
            Confirm investment setup
          </button>
          <DemoEvent
            onError={setError}
            type="surplus_check"
            label="Demo: check available funds"
            onComplete={() => {
              window.dispatchEvent(new Event("agent-bank:invoices-updated"));
              apiFetch("/api/chat/messages").then(async (r) => {
                if (r.ok) {
                  setMessages(await r.json());
                }
              });
            }}
          />
          <button
            disabled={busy || !!approval || !!mailPermission}
            onClick={() => send("Redeem all investments to TD")}
          >
            Redeem all investments to TD
          </button>
        </div>
      </details>
      <form
        className="agent-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <label htmlFor="chat-input">Message the agent</label>
        <div className="composer">
          <input
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask about payments, investments, or rules…"
          />
          <button
            disabled={busy || !!approval || !!mailPermission || !text.trim()}
          >
            Send
          </button>
        </div>
      </form>
      {mailPermission && (
        <section
          className="panel approval-policy"
          aria-label="Email access confirmation"
        >
          <h2>Allow email access</h2>
          <p>Agent: bank-agent</p>
          <p>
            Allowed actions: read banking data, propose terms, and read selected
            emails
          </p>
          <p>
            Email access:{" "}
            {mailPermission.mailIds
              .map((id) =>
                id === "aoba-mail"
                  ? "Aoba Design sample email"
                  : "Sakura Office sample email",
              )
              .join(", ")}
          </p>
          <div className="approval-actions">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiPost("/api/delegations/confirm", {
                    proposalId: mailPermission.proposalId,
                  });
                  const request = mailPermission.text;
                  setMailPermission(undefined);
                  setBusy(false);
                  await send(request);
                } catch (e) {
                  setError(String(e));
                  setBusy(false);
                }
              }}
            >
              Authorize and review
            </button>
            <button
              disabled={busy}
              onClick={() => setMailPermission(undefined)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      {approval && (
        <WorldApproval
          input={approval.input}
          onCancel={() => {
            setApproval(undefined);
            setError("Approval canceled. Your settings have not changed.");
          }}
          onApproved={async () => {
            const completed = approval;
            setApproval(undefined);
            if (completed.input.purpose === "delegation")
              await send(completed.text);
            else {
              window.dispatchEvent(new Event("agent-bank:invoices-updated"));
              window.dispatchEvent(new Event("agent-bank:rules-updated"));
              const response = await apiFetch("/api/chat/messages");
              if (!response.ok)
                throw new Error("Unable to load the latest conversation.");
              setMessages(await response.json());
            }
          }}
        />
      )}
      {error && (
        <p className="agent-error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
