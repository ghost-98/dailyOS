"use client";

import { Activity, ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { AuthGate, signOutDailyOS, useDailyOSUser } from "@/components/auth/AuthGate";
import { mobileNav, primaryNav } from "@/components/layout/navigation";

type AppShellProps = {
  activeKey?: string;
  children: ReactNode;
};

export function AppShell({ activeKey = "today", children }: AppShellProps) {
  return (
    <AuthGate>
      <AppShellContent activeKey={activeKey}>{children}</AppShellContent>
    </AuthGate>
  );
}

function AppShellContent({ activeKey = "today", children }: AppShellProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    capture: activeKey === "capture" || activeKey === "life-activities",
    career: activeKey === "career",
    life: activeKey === "life",
    places: activeKey === "places",
  });
  const { displayName, user } = useDailyOSUser();
  const avatarInitial = displayName.trim().slice(0, 1).toUpperCase() || "D";

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div>
          <Link className="brand" href="/" aria-label="dailyOS 홈으로 이동">
            <span className="brand__mark">d</span>
            <div>
              <span className="brand__name">dailyOS</span>
              <span className="brand__subtitle">Life Database OS</span>
            </div>
          </Link>

          <nav className="sidebar__nav">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = isPrimaryNavActive(item.key, item.href, pathname, activeKey);

              if (item.children) {
                return (
                  <NavGroup
                    icon={<Icon aria-hidden size={22} />}
                    isActive={isActive}
                    isOpen={Boolean(openGroups[item.key])}
                    items={item.children}
                    key={item.key}
                    label={item.label}
                    pathname={pathname}
                    setIsOpen={() => toggleGroup(item.key)}
                  />
                );
              }

              return (
                <Link className={`nav-item ${isActive ? "nav-item--active" : ""}`} href={item.href} key={item.key}>
                  <Icon aria-hidden size={22} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar__footer">
          <div className="profile">
            <div className="profile__avatar">{avatarInitial}</div>
            <div className="profile__meta">
              <strong>{displayName}</strong>
              <span>
                <Activity aria-hidden size={13} />
                {user.email ?? "로그인됨"}
              </span>
            </div>
            <button className="profile__logout" aria-label="로그아웃" onClick={() => void signOutDailyOS()} type="button">
              <LogOut aria-hidden size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-panel">{children}</main>

      <nav className="bottom-nav" aria-label="하단 메뉴">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const isActive = isMobileNavActive(item.key, item.href, pathname, activeKey);
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

function isPrimaryNavActive(key: string, href: string, pathname: string, activeKey?: string) {
  if (key === "capture") return ["/life/activities", "/life/logs", "/life/photos", "/life/health"].includes(pathname);
  if (key === "life") return pathname === "/life" || ["/life/report", "/life/monthly", "/life/search", "/life/people"].includes(pathname);
  if (key === "places") return pathname === "/places" || pathname.startsWith("/life/places") || pathname === "/life/map";
  if (key.startsWith("life-")) return pathname === href;
  return key === activeKey || pathname === href;
}

function isMobileNavActive(key: string, href: string, pathname: string, activeKey?: string) {
  if (key === "life") return pathname === "/life";
  if (key === "life-activities") return ["/life/activities", "/life/logs", "/life/photos", "/life/health"].includes(pathname);
  if (key === "places") return pathname === "/places" || pathname.startsWith("/life/places") || pathname === "/life/map";
  if (key.startsWith("life-")) return pathname === href;
  return key === activeKey || pathname === href;
}

function NavGroup({
  icon,
  isActive,
  isOpen,
  items,
  label,
  pathname,
  setIsOpen,
}: {
  icon: ReactNode;
  isActive: boolean;
  isOpen: boolean;
  items: Array<{ href: string; key: string; label: string }>;
  label: string;
  pathname: string;
  setIsOpen: () => void;
}) {
  return (
    <div className={`nav-group ${isOpen ? "nav-group--open" : ""}`}>
      <button
        aria-expanded={isOpen}
        className={`nav-item nav-item--button ${isActive ? "nav-item--active nav-item--group-active" : ""}`}
        onClick={setIsOpen}
        type="button"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown aria-hidden className="nav-item__chevron" size={17} />
      </button>

      <div className="nav-submenu">
        {items.map((child) => (
          <Link className={`nav-subitem ${pathname === child.href ? "nav-subitem--active" : ""}`} href={child.href} key={child.key}>
            <span>{child.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
