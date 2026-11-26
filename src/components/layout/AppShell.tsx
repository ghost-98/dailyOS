"use client";

import { usePathname } from "next/navigation";
import { DesktopHeader, desktopPages } from "@/components/layout/DesktopHeader";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { mobileNav } from "@/components/layout/navigation";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { OfflineQueueStatus } from "@/components/layout/OfflineQueueStatus";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGate>
      <AppShellContent>{children}</AppShellContent>
    </AuthGate>
  );
}

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname();
  const activePage = mobileNav.find((item) => isPageActive(pathname, item.href));
  const title = activePage?.key === "record" ? "새 기록" : desktopPages.find(({ key }) => key === activePage?.key)?.label;

  return (
    <div className="app-shell app-shell--mobile">
      <DesktopHeader activePage={activePage?.key} />
      <main className="main-panel" data-page={activePage?.key} aria-label={title}>
        {children}
      </main>
      <OfflineQueueStatus />

      <MobileNavigation activePage={activePage?.key} />
    </div>
  );
}

function isPageActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
