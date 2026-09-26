"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [
  ["/", "ホーム"],
  ["/invoices", "送金予定"],
  ["/investment", "資金計画・運用"],
  ["/rules", "自動実行ルール"],
];
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインナビゲーション">
      {items.map(([href, title]) => (
        <Link
          href={href}
          key={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
