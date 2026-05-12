"use client";

import { useState } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, ListFilter, MapPin, Plus, Repeat2, X } from "lucide-react";
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
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
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
        <button className="header-action" onClick={() => setIsEventSheetOpen(true)}>
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

      {isEventSheetOpen ? <EventCreateSheet onClose={() => setIsEventSheetOpen(false)} /> : null}
    </div>
  );
}

function EventCreateSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="event-sheet-title"
        aria-modal="true"
        className="event-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />

        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>
            취소
          </button>
          <h2 id="event-sheet-title">새로운 일정</h2>
          <button className="event-sheet__done-button" onClick={onClose}>
            추가
          </button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card event-form-card--title">
            <label>
              <span>제목</span>
              <input autoFocus placeholder="일정 제목" />
            </label>
            <label>
              <span>장소 또는 화상 회의</span>
              <input placeholder="위치" />
            </label>
          </div>

          <div className="event-form-card">
            <div className="event-form-row">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>하루 종일</span>
              </div>
              <label className="ios-switch">
                <input type="checkbox" />
                <span />
              </label>
            </div>

            <label className="event-form-row event-form-row--field">
              <span>시작</span>
              <input type="datetime-local" defaultValue="2026-05-12T09:00" />
            </label>

            <label className="event-form-row event-form-row--field">
              <span>종료</span>
              <input type="datetime-local" defaultValue="2026-05-12T10:00" />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>캘린더</span>
              </div>
              <select defaultValue="schedule">
                <option value="schedule">일정</option>
                <option value="todo">할 일</option>
                <option value="health">운동</option>
                <option value="career">취업</option>
              </select>
            </label>

            <label className="event-form-row event-form-row--select">
              <div className="event-form-row__label">
                <Bell aria-hidden size={18} />
                <span>알림</span>
              </div>
              <select defaultValue="10m">
                <option value="none">없음</option>
                <option value="10m">10분 전</option>
                <option value="30m">30분 전</option>
                <option value="1d">1일 전</option>
              </select>
            </label>

            <label className="event-form-row event-form-row--select">
              <div className="event-form-row__label">
                <Repeat2 aria-hidden size={18} />
                <span>반복</span>
              </div>
              <select defaultValue="none">
                <option value="none">안 함</option>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
              </select>
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--field">
              <div className="event-form-row__label">
                <MapPin aria-hidden size={18} />
                <span>카테고리</span>
              </div>
              <input placeholder="업무, 학습, 개인..." />
            </label>
            <label className="event-note">
              <span>메모</span>
              <textarea placeholder="일정에 필요한 내용을 적어두세요." rows={4} />
            </label>
          </div>
        </div>

        <button className="event-sheet__floating-close" aria-label="닫기" onClick={onClose}>
          <X aria-hidden size={18} />
        </button>
      </section>
    </div>
  );
}
