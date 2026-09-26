import Link from "next/link";
import { aiMode } from "@/integrations/ai";
import { AuthGate } from "./auth-gate";
import "./style.css";
import { Navigation } from "./navigation";
import { AgentPanel } from "./chat/agent-panel";
export const metadata = {
  title: "Agent Bank — ローカルデモ",
  description: "人が決め、Agentが実行する銀行",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main">
          本文へ移動
        </a>
        <AuthGate>
          <div className="app-shell">
            <aside className="sidebar">
              <Link href="/" className="brand">
                <span className="brand-mark" aria-hidden="true">
                  ab
                </span>
                Agent Bank
                <span className="brand-caption">あなたの条件で動く銀行</span>
              </Link>
              <Navigation />
              <small>
                TD：ローカルAnvil
                <br />
                AI：{aiMode() === "gemini" ? "Gemini" : "stub"} /
                資産接続は各画面に表示
              </small>
            </aside>
            <main id="main">{children}</main>
            <AgentPanel />
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
