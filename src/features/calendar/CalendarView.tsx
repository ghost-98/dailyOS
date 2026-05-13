"use client";

import { useState } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, ListFilter, MapPin, Pencil, Plus, Repeat2, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { EventType } from "@/types/domain";
import { calendarEvents, calendarTypeLabels, type CalendarEvent } from "./data";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date(2026, 4, 1);

const eventTone: Record<EventType, "violet" | "green" | "pink" | "amber" | "muted"> = {
  schedule: "violet",
  todo: "green",
  event: "pink",
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

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSelectedDate(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function summarizeEventsByType(events: typeof calendarEvents) {
  return (Object.keys(calendarTypeLabels) as EventType[])
    .map((type) => ({
      type,
      count: events.filter((event) => event.type === type).length,
    }))
    .filter((summary) => summary.count > 0);
}

type CalendarViewProps = {
  addButtonLabel?: string;
  description?: string;
  title?: string;
};

export function CalendarView({
  addButtonLabel = "일정 추가",
  description = "일정, 할 일, 건강, 취업 날짜를 한 번에 봅니다.",
  title = "캘린더",
}: CalendarViewProps) {
  const [activeCategory, setActiveCategory] = useState<EventType>("schedule");
  const [events, setEvents] = useState<CalendarEvent[]>(calendarEvents);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const selectedEvents = selectedDate
    ? events.filter((event) => event.date === selectedDate && event.type === activeCategory)
    : [];
  const selectedDateAllEvents = selectedDate ? events.filter((event) => event.date === selectedDate) : [];

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + direction, 1));
    setSelectedDate(null);
    setActiveCategory("schedule");
  };

  const handleDateClick = (date: string) => {
    setSelectedDate((current) => (current === date ? null : date));
    setActiveCategory("schedule");
  };

  return (
    <div className="calendar-page">
      <header className="calendar-header page-header">
        <div>
          <h1>{title}</h1>
          <div className="today__date">
            <CalendarDays aria-hidden size={20} />
            <span>{description}</span>
          </div>
        </div>
        <button className="header-action" onClick={() => {
          setEditingEvent(null);
          setIsEventSheetOpen(true);
        }}>
          <Plus aria-hidden size={18} />
          {addButtonLabel}
        </button>
      </header>

      <div className={`calendar-layout ${selectedDate ? "calendar-layout--detail-open" : ""}`}>
        <SectionCard className="calendar-board">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)}>
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button className="calendar-month-trigger" onClick={() => setIsMonthPickerOpen(true)}>
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </button>
            <button aria-label="다음 달" onClick={() => moveMonth(1)}>
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
              const dayEvents = cell.date ? events.filter((event) => event.date === cell.date) : [];
              const eventSummaries = summarizeEventsByType(dayEvents);
              return (
                <button
                  className={`calendar-day ${cell.date === selectedDate ? "calendar-day--selected" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? handleDateClick(cell.date) : undefined)}
                >
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {eventSummaries.slice(0, 3).map((summary) => (
                      <span
                        aria-label={`${calendarTypeLabels[summary.type]} ${summary.count}개`}
                        className="calendar-day__event-chip"
                        key={summary.type}
                        title={`${calendarTypeLabels[summary.type]} ${summary.count}개`}
                      >
                        <span className={`calendar-dot calendar-dot--${summary.type}`} />
                        {summary.count > 1 ? <span className="calendar-day__event-count">+{summary.count}</span> : null}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {selectedDate ? (
        <aside className="calendar-detail">
          <SectionCard className="date-detail-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SELECTED DATE</p>
                <h2>{formatSelectedDate(selectedDate)}</h2>
              </div>
            </div>

            <div className="date-category-tabs" aria-label="상세 카테고리">
              {(Object.keys(calendarTypeLabels) as EventType[]).map((type) => {
                const count = selectedDateAllEvents.filter((event) => event.type === type).length;
                return (
                  <button
                    className={`date-category-tab ${activeCategory === type ? "date-category-tab--active" : ""}`}
                    key={type}
                    onClick={() => setActiveCategory(type)}
                  >
                    <span className={`calendar-dot calendar-dot--${type}`} />
                    {calendarTypeLabels[type]}
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>

            <div className="date-event-list">
              {selectedEvents.length > 0 ? (
                selectedEvents.map((event) => (
                  <article className={`date-event date-event--${event.type}`} key={event.id}>
                    <div>
                      <Badge tone={eventTone[event.type]}>{calendarTypeLabels[event.type]}</Badge>
                      <h3>{event.title}</h3>
                      <p>{event.time ? `${event.time} · ${event.meta}` : event.meta}</p>
                    </div>
                    <div className="date-event__actions">
                      <button aria-label="수정" onClick={() => {
                        setEditingEvent(event);
                        setIsEventSheetOpen(true);
                      }}>
                        <Pencil aria-hidden size={15} />
                      </button>
                      <button aria-label="삭제" onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}>
                        <Trash2 aria-hidden size={15} />
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="date-empty-state">
                  <ListFilter aria-hidden size={24} />
                  <strong>{calendarTypeLabels[activeCategory]} 항목이 없습니다.</strong>
                  <p>이 날짜에 기록된 다른 카테고리를 선택해보세요.</p>
                </div>
              )}
            </div>
          </SectionCard>
        </aside>
        ) : null}
      </div>

      {isEventSheetOpen ? (
        <EventCreateSheet
          defaultDate={selectedDate ?? formatDateKey(currentMonth)}
          event={editingEvent}
          onClose={() => {
            setIsEventSheetOpen(false);
            setEditingEvent(null);
          }}
          onSave={(event) => {
            setEvents((current) => {
              const exists = current.some((item) => item.id === event.id);
              return exists ? current.map((item) => item.id === event.id ? event : item) : [event, ...current];
            });
            setIsEventSheetOpen(false);
            setEditingEvent(null);
          }}
        />
      ) : null}
      {isMonthPickerOpen ? (
        <MonthPickerSheet
          currentMonth={currentMonth}
          onClose={() => setIsMonthPickerOpen(false)}
          onSelect={(month) => {
            setCurrentMonth(month);
            setSelectedDate(null);
            setActiveCategory("schedule");
            setIsMonthPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MonthPickerSheet({
  currentMonth,
  onClose,
  onSelect,
}: {
  currentMonth: Date;
  onClose: () => void;
  onSelect: (month: Date) => void;
}) {
  const [year, setYear] = useState(currentMonth.getFullYear());
  const [month, setMonth] = useState(currentMonth.getMonth() + 1);

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="month-picker-title"
        aria-modal="true"
        className="event-sheet date-picker-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>취소</button>
          <h2 id="month-picker-title">월 선택</h2>
          <button className="event-sheet__done-button" onClick={() => onSelect(new Date(year, month - 1, 1))}>완료</button>
        </header>

        <div className="date-picker-body">
          <div className="date-picker-preview">{year}년 {month}월</div>
          <div className="date-picker-grid date-picker-grid--month">
            <label>
              <span>연도</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {Array.from({ length: 11 }, (_, index) => 2021 + index).map((value) => (
                  <option key={value} value={value}>{value}년</option>
                ))}
              </select>
            </label>
            <label>
              <span>월</span>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{value}월</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}

function EventCreateSheet({
  defaultDate,
  event,
  onClose,
  onSave,
}: {
  defaultDate: string;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [time, setTime] = useState(event?.time ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "schedule");
  const [meta, setMeta] = useState(event?.meta ?? "");

  const saveEvent = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: event?.id ?? `calendar-${Date.now()}`,
      date,
      type,
      title: trimmedTitle,
      time: time || undefined,
      meta: meta.trim() || "메모 없음",
    });
  };

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
          <h2 id="event-sheet-title">{event ? "일정 수정" : "새로운 일정"}</h2>
          <button className="event-sheet__done-button" onClick={saveEvent}>
            {event ? "저장" : "추가"}
          </button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card event-form-card--title">
            <label>
              <span>제목</span>
              <input autoFocus placeholder="일정 제목" value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} />
            </label>
            <label>
              <span>장소 또는 화상 회의</span>
              <input placeholder="위치 또는 메모" value={meta} onChange={(changeEvent) => setMeta(changeEvent.target.value)} />
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
              <span>날짜</span>
              <input type="date" value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field">
              <span>시간</span>
              <input type="time" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>캘린더</span>
              </div>
              <select value={type} onChange={(changeEvent) => setType(changeEvent.target.value as EventType)}>
                <option value="schedule">일정</option>
                <option value="todo">할 일</option>
                <option value="event">이벤트</option>
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
