"use client";

import {
  Activity,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Grid2X2,
  HeartPulse,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

const careerChildren = [
  { label: "지원한 공기업", href: "/career/applied", key: "applied" },
  { label: "지원 예정", href: "/career/planned", key: "planned" },
  { label: "자격증", href: "/career/certificates", key: "certificates" },
];

const primaryNav = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "일정", href: "/schedule", key: "schedule", icon: CalendarDays },
  { label: "이벤트", href: "/events", key: "events", icon: Bell },
  { label: "할 일", href: "/tasks", key: "tasks", icon: CheckCircle2 },
  { label: "건강", href: "/health", key: "health", icon: HeartPulse },
  { label: "취업", href: "/career/applied", key: "career", icon: BriefcaseBusiness, children: careerChildren },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];

const mobileNav = primaryNav.filter((item) => item.key !== "settings");

type AppShellProps = {
  activeKey?: string;
  children: ReactNode;
};

export function AppShell({ activeKey = "today", children }: AppShellProps) {
  const pathname = usePathname();
  const [isCareerOpen, setIsCareerOpen] = useState(activeKey === "career");

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div>
          <Link className="brand" href="/" aria-label="dailyOS 메인화면으로 이동">
            <span className="brand__mark">d</span>
            <div>
              <span className="brand__name">dailyOS</span>
              <span className="brand__subtitle">Personal dashboard</span>
            </div>
          </Link>

          <nav className="sidebar__nav">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activeKey;

              if (item.key === "career") {
                return (
                  <div className={`nav-group ${isCareerOpen ? "nav-group--open" : ""}`} key={item.key}>
                    <button
                      aria-expanded={isCareerOpen}
                      className={`nav-item nav-item--button ${isActive ? "nav-item--active" : ""}`}
                      onClick={() => setIsCareerOpen((current) => !current)}
                      type="button"
                    >
                      <Icon aria-hidden size={22} />
                      <span>{item.label}</span>
                      <ChevronDown aria-hidden className="nav-item__chevron" size={17} />
                    </button>

                    <div className="nav-submenu">
                      {careerChildren.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link className={`nav-subitem ${isChildActive ? "nav-subitem--active" : ""}`} href={child.href} key={child.key}>
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
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
                오늘도 운영 중
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-panel">{children}</main>

      <nav className="bottom-nav" aria-label="모바일 메뉴">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link className={`bottom-nav__item ${item.key === activeKey ? "bottom-nav__item--active" : ""}`} href={item.href} key={item.key}>
              <Icon aria-hidden size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
