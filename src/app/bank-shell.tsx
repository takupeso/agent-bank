"use client";

import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { usePathname } from "next/navigation";
import { AuthGate, LogoutButton } from "./auth-gate";
import { Navigation } from "./navigation";
import { AgentPanel } from "./chat/agent-panel";

export function BankShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/world-agents" || pathname === "/world-agents/connect")
    return <>{children}</>;
  return (
    <AuthGate>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <BrandLogo size={36} tone="dark" />
            </span>
            Agent Bank
          </Link>
          <Navigation />
          <LogoutButton />
        </aside>
        <main id="main">{children}</main>
        <AgentPanel />
      </div>
    </AuthGate>
  );
}
