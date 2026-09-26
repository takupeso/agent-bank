import Link from "next/link";
import { AuthGate, LogoutButton } from "./auth-gate";
import "./style.css";
import { Navigation } from "./navigation";
import { BrandLogo } from "./brand-logo";
import { AgentPanel } from "./chat/agent-panel";
export const metadata = {
  title: "Agent Bank — Local demo",
  description: "You set the terms. Your agent handles the banking.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
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
      </body>
    </html>
  );
}
