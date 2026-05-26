"use client";

import { Activity, CalendarDays, HeartPulse, ListChecks, Map, NotebookPen, WalletCards } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView } from "@/features/calendar/CalendarView";
import { HealthView } from "@/features/health/HealthView";
import { LedgerView } from "@/features/ledger/LedgerView";
import { PlacesView } from "@/features/places/PlacesView";

type LifeViewMode = "calendar" | "map" | "list";

const viewOptions: Array<{
  description: string;
  icon: typeof CalendarDays;
  key: LifeViewMode;
  label: string;
}> = [
  {
    key: "calendar",
    label: "캘린더",
    description: "일정, 할 일, 이벤트를 날짜 중심으로 관리",
    icon: CalendarDays,
  },
  {
    key: "map",
    label: "지도",
    description: "저장한 장소와 방문 맥락을 위치 중심으로 확인",
    icon: Map,
  },
  {
    key: "list",
    label: "리스트",
    description: "가계부, 건강, 하루 기록을 관리 화면으로 확인",
    icon: ListChecks,
  },
];

const listSections = [
  {
    label: "가계부",
    description: "일간/월간 지출을 기록하고 확인합니다.",
    icon: WalletCards,
  },
  {
    label: "건강",
    description: "몸무게와 운동 기록을 날짜별로 관리합니다.",
    icon: HeartPulse,
  },
  {
    label: "하루 기록",
    description: "하루 기록은 라이프 안에서 이어서 확장할 영역입니다.",
    icon: NotebookPen,
  },
];

export function LifeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = getLifeViewMode(searchParams.get("view"));

  const changeView = (view: LifeViewMode) => {
    router.push(`/life?view=${view}`);
  };

  return (
    <div className="life-page">
      <header className="page-header life-header">
        <div>
          <h1>라이프</h1>
          <div className="today__date">
            <Activity aria-hidden size={20} />
            <span>시간과 장소를 하나의 생활 흐름으로 관리합니다.</span>
          </div>
        </div>
      </header>

      <section className="life-switcher" aria-label="라이프 보기 전환">
        {viewOptions.map((option) => {
          const Icon = option.icon;
          const isActive = activeView === option.key;

          return (
            <button className={`life-switcher__item ${isActive ? "life-switcher__item--active" : ""}`} key={option.key} onClick={() => changeView(option.key)} type="button">
              <Icon aria-hidden size={19} />
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          );
        })}
      </section>

      {activeView === "calendar" ? (
        <CalendarView allowedTypes={["schedule", "event", "todo"]} showEventAddButton title="라이프 캘린더" />
      ) : null}

      {activeView === "map" ? <PlacesView /> : null}

      {activeView === "list" ? (
        <div className="life-list-view">
          <section className="life-list-overview" aria-label="라이프 관리 영역">
            {listSections.map((section) => {
              const Icon = section.icon;

              return (
                <article className="life-list-overview__item" key={section.label}>
                  <Icon aria-hidden size={19} />
                  <div>
                    <strong>{section.label}</strong>
                    <p>{section.description}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <LedgerView />
          <HealthView />

          <section className="daily-log-page life-daily-log-panel">
            <header className="page-header">
              <div>
                <h2>하루 기록</h2>
                <div className="today__date">
                  <NotebookPen aria-hidden size={18} />
                  <span>하루 회고와 메모를 라이프 흐름에 연결할 예정입니다.</span>
                </div>
              </div>
            </header>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function getLifeViewMode(value: string | null): LifeViewMode {
  if (value === "map" || value === "list") return value;
  return "calendar";
}
