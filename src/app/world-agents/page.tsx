"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "../brand-logo";

type Status = {
  configured: boolean;
  status:
    | "idle"
    | "pending"
    | "verifying"
    | "verified"
    | "cancelled"
    | "expired"
    | "failed";
};
const messages: Record<Exclude<Status["status"], "verified">, string> = {
  idle: "Verify with World to test your connection to Agent Bank.",
  pending:
    "Waiting for verification. Complete it on World or cancel this request.",
  verifying: "Checking your verification result.",
  cancelled: "Verification cancelled. No banking access was granted.",
  expired: "Verification expired. Start again to continue.",
  failed: "Verification failed. No banking access was granted.",
};
export default function WorldAgentsPage() {
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    const response = await fetch("/api/world-agents/status", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load verification status.");
    setStatus(await response.json());
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  async function act(action: "begin" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/world-agents/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok)
        throw new Error(
          "Unable to connect. Check the configuration and connection, then try again.",
        );
      const result = await response.json();
      if (action === "begin") window.location.assign(result.authorizationUrl);
      else await refresh();
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
        <h1>
          {status?.status === "verified"
            ? "World verified"
            : "Connect with World"}
        </h1>
        {status?.status !== "verified" && (
          <p role="status">
            {status ? messages[status.status] : "Checking your connection…"}
          </p>
        )}
        {status && !status.configured && (
          <p>A developer needs to configure the World connection.</p>
        )}
        {status?.status === "verified" && (
          <p>
            <Link href="/world-agents/connect">
              Continue to account connection →
            </Link>
          </p>
        )}
        <button
          disabled={!status?.configured || busy}
          onClick={() => void act("begin")}
        >
          {busy
            ? "Connecting…"
            : status?.status === "verified"
              ? "Verify again with World"
              : "Verify with World"}
        </button>
        {status && ["pending", "verifying"].includes(status.status) && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void act("cancel")}
          >
            Cancel verification
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
