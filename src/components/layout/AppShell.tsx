import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Grid2X2,
  HeartPulse,
  Plus,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

const primaryNav = [
  { label: "오늘", icon: Grid2X2, active: true },
  { label: "캘린더", icon: CalendarDays },
  { label: "시간관리", icon: Clock3 },
  { label: "건강", icon: HeartPulse },
  { label: "취업", icon: BriefcaseBusiness },
  { label: "설정", icon: Settings },
];

const mobileNav = primaryNav.slice(0, 5);

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div>
          <div className="brand">
            <span className="brand__name">dailyOS</span>
            <span className="brand__version">v1.0.4-alpha</span>
          </div>

          <nav className="sidebar__nav">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <button className={`nav-item ${item.active ? "nav-item--active" : ""}`} key={item.label}>
                  <Icon aria-hidden size={22} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar__footer">
          <button className="new-entry">
            <Plus aria-hidden size={17} />
            새 기록
          </button>

          <div className="profile">
            <div className="profile__avatar">D</div>
            <div>
              <strong>daily user</strong>
              <span>
                <Activity aria-hidden size={13} />
                동기화 대기
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-panel">{children}</main>

      <nav className="bottom-nav" aria-label="하단 메뉴">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          return (
            <button className={`bottom-nav__item ${item.active ? "bottom-nav__item--active" : ""}`} key={item.label}>
              <Icon aria-hidden size={20} />
              <span>{item.label}</span>
            </button>
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
