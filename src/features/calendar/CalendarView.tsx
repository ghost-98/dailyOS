import { CalendarDays, ChevronLeft, ChevronRight, ListFilter, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { EventType } from "@/types/domain";
import { calendarEvents, calendarTypeLabels } from "./data";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const selectedDate = "2026-05-12";

const eventTone: Record<EventType, "violet" | "green" | "pink" | "amber" | "muted"> = {
  schedule: "violet",
  todo: "green",
  health: "pink",
  weight: "muted",
  career: "amber",
};

function getMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmptyDays = firstDay.getDay();

  return [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({ key: `empty-${index}`, day: null, date: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { key: date, day, date };
    }),
  ];
}

export function CalendarView() {
  const monthDays = getMonthDays(2026, 4);
  const selectedEvents = calendarEvents.filter((event) => event.date === selectedDate);
  const monthEventCount = calendarEvents.length;

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <div>
          <p className="eyebrow">CALENDAR MATRIX</p>
          <h1>캘린더</h1>
          <div className="today__date">
            <CalendarDays aria-hidden size={20} />
            <span>일정, 할 일, 건강, 취업 날짜를 한 번에 봅니다.</span>
          </div>
        </div>
        <button className="header-action">
          <Plus aria-hidden size={18} />
          일정 추가
        </button>
      </header>

      <div className="calendar-layout">
        <SectionCard className="calendar-board">
          <div className="calendar-toolbar">
            <button aria-label="이전 달">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <div>
              <span>2026</span>
              <strong>5월</strong>
            </div>
            <button aria-label="다음 달">
              <ChevronRight aria-hidden size={20} />
            </button>
          </div>

          <div className="calendar-filters" aria-label="유형 필터">
            {(Object.keys(calendarTypeLabels) as EventType[]).map((type) => (
              <span className={`calendar-filter calendar-filter--${type}`} key={type}>
                {calendarTypeLabels[type]}
              </span>
            ))}
          </div>

          <div className="calendar-weekdays">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthDays.map((cell) => {
              const events = cell.date ? calendarEvents.filter((event) => event.date === cell.date) : [];
              return (
                <button className={`calendar-day ${cell.date === selectedDate ? "calendar-day--selected" : ""}`} disabled={!cell.date} key={cell.key}>
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {events.slice(0, 3).map((event) => (
                      <span className={`calendar-dot calendar-dot--${event.type}`} key={event.id} title={event.title} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <aside className="calendar-detail">
          <SectionCard className="calendar-summary">
            <div className="card-title">
              <ListFilter aria-hidden size={20} />
              <span>월간 상태</span>
            </div>
            <strong>{monthEventCount}</strong>
            <p>이번 달 기록된 날짜 기반 항목</p>
          </SectionCard>

          <SectionCard className="date-detail-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SELECTED DATE</p>
                <h2>5월 12일 화요일</h2>
              </div>
            </div>

            <div className="date-event-list">
              {selectedEvents.map((event) => (
                <article className={`date-event date-event--${event.type}`} key={event.id}>
                  <div>
                    <Badge tone={eventTone[event.type]}>{calendarTypeLabels[event.type]}</Badge>
                    <h3>{event.title}</h3>
                    <p>{event.time ? `${event.time} · ${event.meta}` : event.meta}</p>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
