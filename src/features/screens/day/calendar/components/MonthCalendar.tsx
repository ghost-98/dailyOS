"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { getMonthDays } from "@/features/calendar/dateUtils";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthCalendar({
  countsByDate,
  monthCursor,
  onNextMonth,
  onPrevMonth,
  onSelectDate,
  selectedDate,
  title,
}: {
  countsByDate: Map<string, number> | Record<string, number>;
  monthCursor: Date;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
  title?: string;
}) {
  const monthDays = useMemo(() => getMonthDays(monthCursor.getFullYear(), monthCursor.getMonth()), [monthCursor]);
  const monthLabel = useMemo(() => new Intl.DateTimeFormat("ko-KR", { month: "long", year: "numeric" }).format(monthCursor), [monthCursor]);

  const getCount = (date?: string | null) => {
    if (!date) return 0;
    return countsByDate instanceof Map ? countsByDate.get(date) ?? 0 : countsByDate[date] ?? 0;
  };

  return (
    <div className="record-month-calendar">
      {title ? <p className="record-month-calendar__eyebrow">{title}</p> : null}
      <div className="life-activity-calendar">
        <div className="life-activity-calendar__header">
          <IconButton label="이전 달" onClick={onPrevMonth} size="sm" tone="outline">
            <ChevronLeft aria-hidden size={16} />
          </IconButton>
          <div className="life-activity-calendar__month-picker">
            <div className="life-activity-calendar__month-button" role="status" aria-live="polite">
              {monthLabel}
            </div>
          </div>
          <IconButton label="다음 달" onClick={onNextMonth} size="sm" tone="outline">
            <ChevronRight aria-hidden size={16} />
          </IconButton>
        </div>
        <div className="life-activity-calendar__weekdays">
          {weekdays.map((weekday, index) => (
            <span
              className={index === 0 ? "life-activity-calendar__weekday life-activity-calendar__weekday--sun" : index === 6 ? "life-activity-calendar__weekday life-activity-calendar__weekday--sat" : "life-activity-calendar__weekday"}
              key={weekday}
            >
              {weekday}
            </span>
          ))}
        </div>
        <div className="life-activity-calendar__grid">
          {monthDays.map((day) => {
            const weekday = day.date ? new Date(`${day.date}T00:00:00`).getDay() : -1;
            const count = getCount(day.date);
            return (
              <button
                aria-pressed={day.date === selectedDate}
                className={[
                  "life-activity-calendar__day",
                  day.date === selectedDate ? "life-activity-calendar__day--selected" : "",
                  weekday === 0 ? "life-activity-calendar__day--sun" : "",
                  weekday === 6 ? "life-activity-calendar__day--sat" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!day.date}
                key={day.key}
                onClick={() => day.date && onSelectDate(day.date)}
                type="button"
              >
                {day.day ? <span>{day.day}</span> : null}
                {count > 0 ? <em>{count}</em> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}






