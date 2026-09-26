"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "../../brand-logo";

type Grant = { id: string; name: string; scope: string; expiresAt: number };
type Connection = {
  connected: boolean;
  initialized: boolean;
  accountLabel: string;
  grants: Grant[];
  redemptionQuote: { hash: string; totalJpy: string; count: number } | null;
};
type Credential = {
  token: string;
  grantId: string;
  expiresAt: number;
  scope: string;
};
export default function ConnectAccountPage() {
  const [connection, setConnection] = useState<Connection>();
  const [signedIn, setSignedIn] = useState<boolean>();
  const [name, setName] = useState("My external agent");
  const [credential, setCredential] = useState<Credential>();
  const [allowRedemption, setAllowRedemption] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  async function refresh() {
    const r = await fetch("/api/world-agents/connection", {
      cache: "no-store",
    });
    if (r.status === 401) {
      setSignedIn(false);
      setConnection(undefined);
      return;
    }
    if (!r.ok) throw new Error("Unable to load account connection.");
    setSignedIn(true);
    setConnection(await r.json());
  }
  useEffect(() => {
    const update = () =>
      void refresh().catch(() =>
        setError("Unable to load account connection."),
      );
    update();
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  async function act(
    action: "connect" | "grant" | "revoke",
    body: object = {},
  ) {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const r = await fetch(`/api/world-agents/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok)
        throw new Error(
          action === "revoke"
            ? "Unable to revoke access. Check your bank login and try again."
            : "Connection could not be approved. Check your bank login, initialize the demo account, and complete a new World verification before trying again.",
        );
      const value = await r.json();
      if (action === "grant") setCredential(value);
      if (
        action === "revoke" &&
        credential?.grantId === (body as { id: string }).id
      )
        setCredential(undefined);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!credential) return;
    const file = {
      endpoint: new URL("/api/external-agent/balance", window.location.origin)
        .href,
      ...credential,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent-bank-connection.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function tryRead() {
    if (!credential) return;
    setBusy(true);
    setResult("");
    setError("");
    try {
      const r = await fetch("/api/external-agent/balance", {
        credentials: "omit",
        headers: { Authorization: `Bearer ${credential.token}` },
        cache: "no-store",
      });
      if (!r.ok)
        throw new Error(
          "Balance access was denied or is unavailable. Access may have expired or been revoked.",
        );
      setResult(JSON.stringify(await r.json(), null, 2));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-screen">
      <section className="panel">
        <span className="auth-logo">
          <BrandLogo size={56} />
        </span>
        <p>Agent Bank / World ID for Agents</p>
        <h1>{credential ? "Agent connected" : "Connect your account"}</h1>
        <p>Choose what your external agent can do with Account A.</p>
        {signedIn === undefined && (
          <p role="status">Checking your bank login…</p>
        )}
        {signedIn === false && (
          <>
            <h2>1. Log in to your bank account</h2>
            <p>
              World verification and bank account ownership are checked
              separately. Log in, initialize your demo account if needed, then
              return here.
            </p>
            <p>
              <Link href="/" target="_blank" rel="noopener noreferrer">
                Open bank login in a new tab
              </Link>
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void refresh().catch(() =>
                  setError("Unable to check bank login."),
                )
              }
            >
              Check bank login
            </button>
          </>
        )}
        {connection && (
          <>
            <h2>1. {connection.accountLabel}</h2>
            {!connection.initialized && (
              <p>
                Initialize the demo from the bank's demo controls first.{" "}
                <Link href="/" target="_blank" rel="noopener noreferrer">
                  Open bank
                </Link>
              </p>
            )}
            <p>
              {connection.connected
                ? "Your World identity is linked to this account."
                : "Link your verified World identity to your signed-in bank account."}
            </p>
            {!connection.connected && (
              <>
                <button disabled={busy} onClick={() => void act("connect")}>
                  Connect Account A with World
                </button>
                <p>
                  <Link href="/world-agents">
                    Complete or renew World verification
                  </Link>
                </p>
              </>
            )}
            {connection.connected && !credential && (
              <>
                <h2>2. Approve agent access</h2>
                <label className="field">
                  Agent name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                  />
                </label>
                <p>
                  Balance access · Available and locked TD ·{" "}
                  {allowRedemption ? 5 : 15} minutes
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={allowRedemption}
                    disabled={!connection.redemptionQuote}
                    onChange={(e) => setAllowRedemption(e.target.checked)}
                  />
                  Also allow Aave → Token account → Deposit account
                </label>
                {allowRedemption && connection.redemptionQuote ? (
                  <p>
                    Return ¥
                    {BigInt(connection.redemptionQuote.totalJpy).toLocaleString(
                      "en-US",
                    )}{" "}
                    principal from {connection.redemptionQuote.count} invested
                    positions to Account A. One approved redemption, valid for 5
                    minutes. The agent cannot choose another recipient.
                  </p>
                ) : (
                  !connection.redemptionQuote && (
                    <p>No invested positions are available to return.</p>
                  )
                )}
                <p>
                  Each approval uses one fresh World verification. The name is a
                  label you choose, not proof of the agent's identity.
                </p>
                <button
                  disabled={
                    busy ||
                    !connection.initialized ||
                    !name.trim() ||
                    (allowRedemption && !connection.redemptionQuote)
                  }
                  onClick={() =>
                    void act("grant", {
                      name,
                      ...(allowRedemption
                        ? { redemptionHash: connection.redemptionQuote?.hash }
                        : {}),
                    })
                  }
                >
                  {allowRedemption
                    ? "Allow balance access and return to deposit"
                    : "Allow balance access for 15 minutes"}
                </button>
              </>
            )}
            {credential && (
              <>
                <h2>3. Connect your external agent</h2>
                <p>
                  Download the connection file and give it only to your chosen
                  agent. Anyone holding it can use the permissions you approved
                  until expiry or revocation. It is available only on this page
                  until you leave or reload.
                </p>
                <button onClick={download}>Download connection file</button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void tryRead()}
                >
                  Test agent balance access
                </button>
                <p>From the repository, run:</p>
                <pre
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  node scripts/agent-balance.mjs
                  /path/to/agent-bank-connection.json
                </pre>
                {credential.scope.includes("redemption:execute") && (
                  <>
                    <p>To return the approved investments to your deposit:</p>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      node scripts/agent-redeem.mjs
                      /path/to/agent-bank-connection.json
                    </pre>
                    <p>
                      To check progress, add <code>--status</code> to the same
                      command.
                    </p>
                  </>
                )}
              </>
            )}
            {connection.grants.length > 0 && (
              <>
                <h2>Active access</h2>
                {connection.grants.map((g) => (
                  <div key={g.id}>
                    <p>
                      <strong>{g.name}</strong> ·{" "}
                      {g.scope.includes("redemption:execute")
                        ? "Balance + approved return to deposit"
                        : "Balance read only"}
                      <br />
                      Expires {new Date(g.expiresAt).toLocaleTimeString()}
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void act("revoke", { id: g.id })}
                    >
                      Revoke {g.name}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {result && (
          <pre
            role="status"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {result}
          </pre>
        )}
        {error && <p role="alert">{error}</p>}
        <p>
          <Link href="/world-agents">Back to World verification</Link> ·{" "}
          <Link href="/">Back to bank</Link>
        </p>
      </section>
    </main>
  );
}
