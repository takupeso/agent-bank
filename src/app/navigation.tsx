"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [
  ["/", "Home"],
  ["/invoices", "Payments"],
  ["/investment", "Investment plan"],
  ["/rules", "Automation rules"],
];
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
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
