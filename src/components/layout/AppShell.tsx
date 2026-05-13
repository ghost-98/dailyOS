"use client";

import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileBadge,
  FileText,
  Grid2X2,
  HeartPulse,
  Plus,
  Settings,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const careerChildren = [
  { label: "지원한 공기업", href: "/career?tab=applied", key: "applied", icon: BriefcaseBusiness },
  { label: "지원 예정", href: "/career?tab=planned", key: "planned", icon: Target },
  { label: "자격증", href: "/career?tab=certificates", key: "certificates", icon: FileBadge },
  { label: "이력서", href: "/career?tab=resumes", key: "resumes", icon: FileText },
];

const primaryNav = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "일정", href: "/schedule", key: "schedule", icon: CalendarDays },
  { label: "할 일", href: "/tasks", key: "tasks", icon: CheckCircle2 },
  { label: "건강", href: "/health", key: "health", icon: HeartPulse },
  { label: "취업", href: "/career", key: "career", icon: BriefcaseBusiness, children: careerChildren },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];

const mobileNav = primaryNav.slice(0, 5);

type AppShellProps = {
  activeKey?: string;
  children: ReactNode;
};

export function AppShell({ activeKey = "today", children }: AppShellProps) {
  const pathname = usePathname();
  const [isCareerOpen, setIsCareerOpen] = useState(activeKey === "career");
  const [activeCareerTab, setActiveCareerTab] = useState("applied");

  useEffect(() => {
    const syncCareerTab = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveCareerTab(params.get("tab") ?? "applied");
    };

    syncCareerTab();
    window.addEventListener("popstate", syncCareerTab);
    return () => window.removeEventListener("popstate", syncCareerTab);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div>
          <div className="brand">
            <span className="brand__mark">d</span>
            <div>
              <span className="brand__name">dailyOS</span>
              <span className="brand__subtitle">Personal dashboard</span>
            </div>
          </div>

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
                        const ChildIcon = child.icon;
                        const isChildActive = pathname === "/career" && activeCareerTab === child.key;
                        return (
                          <Link
                            className={`nav-subitem ${isChildActive ? "nav-subitem--active" : ""}`}
                            href={child.href}
                            key={child.key}
                            onClick={() => setActiveCareerTab(child.key)}
                          >
                            <ChildIcon aria-hidden size={16} />
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
        <button className="bottom-nav__item">
          <CheckCircle2 aria-hidden size={20} />
          <span>추가</span>
        </button>
      </nav>
    </div>
  );
}
