"use client";
import { apiFetch } from "../api-client";
import { WorldApproval, type WorldRequest } from "../world-approval";
import { DemoEvent, RunDetails } from "./demo-event";
import { Conditions, ProposalCard } from "./rule-card";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  Message,
  Invoice,
  Mail,
  Proposal,
  Rule,
  Run,
} from "@/shared/domain";
export function AgentPanel() {
  const conversation = useRef<HTMLElement>(null);
  const tools = useRef<HTMLDetailsElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [approval, setApproval] = useState<{
    input: WorldRequest;
    text: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch("/api/chat/messages").then(async (r) => {
      if (r.ok) setMessages(await r.json());
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
          "処理を完了できませんでした。現在の設定と実行記録を確認してください。",
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
  return (
    <aside id="agent-panel" className="agent-panel" aria-label="Agentチャット">
      <header className="agent-panel-header">
        <div>
          <h2>Agent</h2>
          <p>依頼や確認をいつでも送れます</p>
        </div>
      </header>
      <section
        ref={conversation}
        className="agent-conversation"
        aria-live="polite"
      >
        {messages.map((m) => (
          <article className={"message " + m.role} key={m.id}>
            <small>{m.role === "user" ? "あなた" : "Agent"}</small>
            <p>{m.text}</p>
            {m.kind === "invoices" &&
              (m.data?.invoices as Invoice[]).map((i) => {
                const mail = (m.data?.emails as Mail[] | undefined)?.find(
                  (item) => item.id === i.emailId,
                );
                return (
                  <div className="card" key={i.id}>
                    <b>{i.issuer}</b>
                    <p>
                      ¥{BigInt(i.amountJpy).toLocaleString()} · 支払期日{" "}
                      {new Date(i.dueAt).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </p>
                    {mail && (
                      <details>
                        <summary>元メールを表示</summary>
                        <p>
                          {mail.sender} · {mail.subject}
                        </p>
                        <p>{mail.body}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            {m.kind === "execution" && <RunDetails run={m.data?.run as Run} />}
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
                <b>承認時の設定</b>
                <p>
                  承認方法：
                  {(m.data?.rule as Rule).authorization?.approvalMethod ===
                  "local-demo"
                    ? "デモ承認（World省略）"
                    : (m.data?.rule as Rule).authorization?.approvalMethod ===
                        "world"
                      ? "World確認"
                      : "未確認（再承認が必要）"}{" "}
                  · 承認時の条件
                </p>
                <Conditions rule={m.data?.rule as Rule} />
              </div>
            )}
          </article>
        ))}
        {pendingText && (
          <article className="message user pending-message">
            <small>あなた</small>
            <p>{pendingText}</p>
          </article>
        )}
        {busy && (
          <article
            className="message agent typing-indicator"
            role="status"
            aria-label="Agentが返信を作成中"
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
      <details ref={tools} className="agent-tools">
        <summary>デモ操作とよく使う依頼</summary>
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
            disabled={busy || !!approval}
            onClick={() => send("サンプルメールの閲覧を許可して確認して")}
          >
            サンプルメールの閲覧を許可して確認
          </button>
          <button
            disabled={busy || !!approval || !hasUnacceptedProposal("payment")}
            onClick={() => send("そうしてください")}
          >
            そうしてください（支払い設定）
          </button>
          <DemoEvent
            onError={setError}
            type="due_date_reached"
            label="デモ：支払期日を迎える"
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
            disabled={busy || !!approval}
            onClick={() => send("余力を運用したい")}
          >
            余力を運用したい
          </button>
          <button
            disabled={
              busy || !!approval || !hasUnacceptedProposal("investment")
            }
            onClick={() => send("そうしてください")}
          >
            そうしてください（運用設定）
          </button>
          <DemoEvent
            onError={setError}
            type="surplus_check"
            label="デモ：余力をチェック"
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
            disabled={busy || !!approval}
            onClick={() => send("運用分を全部TDに戻して")}
          >
            運用分を全部TDに戻して
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
        <label htmlFor="chat-input">Agentへの依頼</label>
        <div className="composer">
          <input
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="メールを確認して、支払いを自動化して"
          />
          <button disabled={busy || !!approval || !text.trim()}>送信</button>
        </div>
      </form>
      {approval && (
        <WorldApproval
          input={approval.input}
          onCancel={() => {
            setApproval(undefined);
            setError("承認をキャンセルしました。設定は変更されていません。");
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
                throw new Error("最新の会話を取得できませんでした。");
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
