"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "../theme/ThemeToggle.js";

const NAV_LINKS = [
  { href: "/parent", label: "Parents" },
  { href: "/child", label: "Kids" }
];

export function AppShell({ title, subtitle, role = "home", actions = null, children }) {
  const pathname = usePathname();

  return (
    <div className={`app-shell app-shell--${role}`}>
      <header className="app-shell__header">
        <div>
          <Link href="/" className="app-shell__brand">
            Home School Helper
          </Link>
          <p className="app-shell__tagline">Learn together, step by step.</p>
        </div>

        <div className="app-shell__controls">
          <nav className="app-shell__nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`app-shell__nav-link${pathname?.startsWith(link.href) ? " is-active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          {actions}
        </div>
      </header>

      <section className="app-shell__hero">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </section>

      <section className="app-shell__content">{children}</section>
    </div>
  );
}
