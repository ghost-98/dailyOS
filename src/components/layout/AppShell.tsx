"use client";

import {
  Activity,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Grid2X2,
  Layers3,
  LogOut,
  Map,
  MapPinned,
  NotebookPen,
  ReceiptText,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { AuthGate, signOutDailyOS, useDailyOSUser } from "@/components/auth/AuthGate";

const lifeChildren = [
  { label: "캘린더", href: "/life/calendar", key: "life-calendar" },
  { label: "하루 리포트", href: "/life/report", key: "life-report" },
  { label: "월간 회고", href: "/life/monthly", key: "life-monthly" },
  { label: "전체 검색", href: "/life/search", key: "life-search" },
  { label: "사람", href: "/life/people", key: "life-people" },
  { label: "AI 질문", href: "/life/ask", key: "life-ask" },
];

const captureChildren = [
  { label: "일정·할일", href: "/life/calendar", key: "life-capture-calendar" },
  { label: "활동 기록", href: "/life/activities", key: "life-activities" },
  { label: "하루기록", href: "/life/logs", key: "life-logs" },
  { label: "사진", href: "/life/photos", key: "life-photos" },
  { label: "건강", href: "/life/health", key: "life-health" },
];

const placeChildren = [
  { label: "장소 보관함", href: "/places", key: "places-vault" },
  { label: "장소 흐름", href: "/life/places-flow", key: "life-places-flow" },
  { label: "장소 지도", href: "/life/map", key: "life-map" },
];

const careerChildren = [
  { label: "지원한 기업", href: "/career/applied", key: "applied" },
  { label: "지원 예정", href: "/career/planned", key: "planned" },
  { label: "자격증", href: "/career/certificates", key: "certificates" },
];

const primaryNav = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "라이프 DB", href: "/life", key: "life", icon: Layers3, children: lifeChildren },
  { label: "기록 입력", href: "/life/logs", key: "capture", icon: NotebookPen, children: captureChildren },
  { label: "가계부", href: "/ledger", key: "ledger", icon: ReceiptText },
  { label: "장소", href: "/places", key: "places", icon: MapPinned, children: placeChildren },
  { label: "취업", href: "/career/applied", key: "career", icon: BriefcaseBusiness, children: careerChildren },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];

const mobileNav = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "라이프", href: "/life", key: "life", icon: Layers3 },
  { label: "캘린더", href: "/life/calendar", key: "life-calendar", icon: CalendarDays },
  { label: "기록", href: "/life/logs", key: "life-logs", icon: BookOpenCheck },
  { label: "질문", href: "/life/ask", key: "life-ask", icon: Sparkles },
  { label: "장소", href: "/places", key: "places", icon: Map },
];

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
    capture: activeKey === "capture",
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
              <span className="brand__subtitle">개인 관리</span>
            </div>
          </Link>

          <nav className="sidebar__nav">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activeKey;

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
          const isActive = item.key === "life" ? pathname === "/life" : item.key.startsWith("life-") ? pathname === item.href : item.key === activeKey;
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
