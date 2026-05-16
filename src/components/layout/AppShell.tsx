"use client";

import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Grid2X2,
  HeartPulse,
  LogOut,
  NotebookPen,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { AuthGate, signOutDailyOS } from "@/components/auth/AuthGate";

const timeChildren = [
  { label: "캘린더", href: "/schedule", key: "schedule" },
];

const careerChildren = [
  { label: "지원한 기업", href: "/career/applied", key: "applied" },
  { label: "지원 예정", href: "/career/planned", key: "planned" },
  { label: "자격증", href: "/career/certificates", key: "certificates" },
];

const primaryNav = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "계획", href: "/schedule", key: "time", icon: CalendarDays, children: timeChildren },
  { label: "하루 기록", href: "/daily-log", key: "daily-log", icon: NotebookPen },
  { label: "취업", href: "/career/applied", key: "career", icon: BriefcaseBusiness, children: careerChildren },
  { label: "건강", href: "/health", key: "health", icon: HeartPulse },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];

const mobileNav = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "계획", href: "/schedule", key: "schedule", icon: CalendarDays },
  { label: "기록", href: "/daily-log", key: "daily-log", icon: NotebookPen },
  { label: "취업", href: "/career/applied", key: "career", icon: BriefcaseBusiness },
  { label: "건강", href: "/health", key: "health", icon: HeartPulse },
];

type AppShellProps = {
  activeKey?: string;
  children: ReactNode;
};

export function AppShell({ activeKey = "today", children }: AppShellProps) {
  const pathname = usePathname();
  const isTimeActive = activeKey === "schedule" || activeKey === "time";
  const [isTimeOpen, setIsTimeOpen] = useState(isTimeActive);
  const [isCareerOpen, setIsCareerOpen] = useState(activeKey === "career");

  return (
    <AuthGate>
      <div className="app-shell">
        <aside className="sidebar" aria-label="주요 메뉴">
          <div>
            <Link className="brand" href="/" aria-label="dailyOS 홈으로 이동">
              <span className="brand__mark">d</span>
              <div>
                <span className="brand__name">dailyOS</span>
                <span className="brand__subtitle">개인 관리</span>
              </div>
            </Link>

            <nav className="sidebar__nav">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeKey || (item.key === "time" && isTimeActive);

                if (item.key === "time") {
                  return (
                    <NavGroup
                      icon={<Icon aria-hidden size={22} />}
                      isActive={isActive}
                      isOpen={isTimeOpen}
                      items={timeChildren}
                      key={item.key}
                      label={item.label}
                      pathname={pathname}
                      setIsOpen={setIsTimeOpen}
                    />
                  );
                }

                if (item.key === "career") {
                  return (
                    <NavGroup
                      icon={<Icon aria-hidden size={22} />}
                      isActive={isActive}
                      isOpen={isCareerOpen}
                      items={careerChildren}
                      key={item.key}
                      label={item.label}
                      pathname={pathname}
                      setIsOpen={setIsCareerOpen}
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
            <button className="new-entry">
              <Plus aria-hidden size={17} />
              새 항목
            </button>

            <div className="profile">
              <div className="profile__avatar">D</div>
              <div>
                <strong>daily user</strong>
                <span>
                  <Activity aria-hidden size={13} />
                  로그인됨
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
            const isActive = item.key === activeKey || (item.key === "career" && activeKey === "career");
            return (
              <Link className={`bottom-nav__item ${isActive ? "bottom-nav__item--active" : ""}`} href={item.href} key={item.key}>
                <Icon aria-hidden size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </AuthGate>
  );
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
  setIsOpen: (updater: (current: boolean) => boolean) => void;
}) {
  return (
    <div className={`nav-group ${isOpen ? "nav-group--open" : ""}`}>
      <button
        aria-expanded={isOpen}
        className={`nav-item nav-item--button ${isActive ? "nav-item--active nav-item--group-active" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
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
