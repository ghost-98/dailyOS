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
          const isActive = isMobileNavActive(pathname, item.href, item.key);
          const Icon = item.icon;

          return (
            <Link className={`bottom-nav__item ${isActive ? "bottom-nav__item--active" : ""}`} href={item.href} key={item.key}>
              <Icon aria-hidden size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isMobileNavActive(pathname: string, href: string, key: string) {
  if (key === "life-activities") return ["/m/life/activities", "/m/life/plans", "/m/life/logs", "/m/life/health"].includes(pathname);
  if (key === "life") return pathname === "/m/life" || ["/m/life/calendar", "/m/life/gallery", "/m/life/search", "/m/life/people"].includes(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
