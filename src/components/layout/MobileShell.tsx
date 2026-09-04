"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { mobileNav } from "@/components/layout/navigation";

type MobileShellProps = {
  children: ReactNode;
};

export function MobileShell({ children }: MobileShellProps) {
  return (
    <AuthGate>
      <MobileShellContent>{children}</MobileShellContent>
    </AuthGate>
  );
}

function MobileShellContent({ children }: MobileShellProps) {
  const pathname = usePathname();

  return (
    <div className="app-shell app-shell--mobile">
      <main className="main-panel">{children}</main>

      <nav className="bottom-nav" aria-label="하단 메뉴">
        {mobileNav.map((item) => {
          const isActive = isMobileNavActive(pathname, item.href);
          const Icon = item.icon;
          const isRecord = item.key === "record";

          return (
            <Link
              aria-label={item.label}
              className={`bottom-nav__item ${isRecord ? "bottom-nav__item--record" : ""} ${isActive ? "bottom-nav__item--active" : ""}`}
              href={item.href}
              key={item.key}
              title={item.label}
            >
              <Icon aria-hidden size={20} />
              {!isRecord ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isMobileNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}



