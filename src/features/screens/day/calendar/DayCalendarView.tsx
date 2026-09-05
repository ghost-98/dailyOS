"use client";

import { useMemo, useState } from "react";
import { MobileCalendarFrame } from "@/features/screens/day/calendar/components/MobileCalendarFrame";
import { MonthCalendar } from "@/features/screens/day/calendar/components/MonthCalendar";
import { LifeCalendarDayPanel as DayCalendarPanel } from "@/features/screens/day/DayCalendarPanel";
import type { EventType } from "@/types/domain";
import { useCalendarResources } from "@/features/screens/day/calendar/hooks/useCalendarResources";
import {
  createEventTimelineItem,
  createExternalTimelineItem,
  createTaskTimelineItem,
  getCategories,
  getTimelineTypeOrder,
  summarizeDay,
} from "@/features/calendar/calendarViewHelpers";
import { formatDateKey, formatFullDate, getMonthDays, isDateInRange } from "@/features/calendar/dateUtils";
import type { CalendarCategory, ExternalCalendarItem } from "@/features/calendar/types";
import type { DayItemActions } from "@/features/screens/day/dayDetailTypes";
type CalendarViewProps = {
  allowedTypes?: EventType[];
  defaultSelectedDate?: string | null;
  externalItems?: ExternalCalendarItem[];
  dayActions?: DayItemActions;
};

const initialMonth = new Date();

export function DayCalendarView(props: CalendarViewProps) {
  return <CalendarViewContent {...props} />;
}

function CalendarViewContent({
  allowedTypes,
  defaultSelectedDate = null,
  externalItems = [],
  dayActions,
}: CalendarViewProps) {
  const categories = useMemo(() => getCategories(allowedTypes), [allowedTypes]);
  const { events, isLoading, setTasks, tasks } = useCalendarResources();
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelectedDate);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const activeDate = selectedDate ?? defaultSelectedDate ?? todayKey;
  const visibleEvents = useMemo(() => events.filter((event) => categories.includes(event.type as CalendarCategory)), [categories, events]);
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const selectedEvents = useMemo(() => visibleEvents.filter((event) => isDateInRange(activeDate, event.date, event.endDate) && event.type === "event"), [activeDate, visibleEvents]);
  const selectedTasks = useMemo(() => tasks.filter((task) => isDateInRange(activeDate, task.scheduledDate, task.dueDate)), [activeDate, tasks]);
  const selectedExternalItems = useMemo(() => externalItems.filter((item) => item.date === activeDate), [activeDate, externalItems]);
  const selectedTimelineItems = useMemo(
    () =>
      [
        ...selectedTasks.map((task) => createTaskTimelineItem(task)),
        ...selectedEvents.map((event) => createEventTimelineItem(event)),
        ...selectedExternalItems.map((external) => createExternalTimelineItem(external)),
      ].sort((first, second) => first.sortMinutes - second.sortMinutes || getTimelineTypeOrder(first.type) - getTimelineTypeOrder(second.type)),
    [selectedEvents, selectedExternalItems, selectedTasks],
  );
  const monthCalendarCounts = useMemo(() => {
    const counts = new Map<string, number>();
    monthDays.forEach((cell) => {
      if (!cell.date) return;
      const dayEvents = visibleEvents.filter((event) => isDateInRange(cell.date as string, event.date, event.endDate));
      const dayTasks = tasks.filter((task) => isDateInRange(cell.date as string, task.scheduledDate, task.dueDate));
      const dayExternalItems = externalItems.filter((item) => item.date === cell.date);
      counts.set(cell.date, summarizeDay(dayEvents, dayTasks, categories, dayExternalItems).totalCount);
    });
    return counts;
  }, [categories, externalItems, monthDays, tasks, visibleEvents]);

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth((month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + direction, 1);
      setSelectedDate(formatDateKey(nextMonth));
      return nextMonth;
    });
  };

  const toggleMobileCalendar = () => {
    setIsCalendarOpen((current) => !current);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setIsCalendarOpen(true);
  };

  return (
    <div className="calendar-page">
      <div className="calendar-board--mobile-shell">
        <MobileCalendarFrame
          calendar={
            <MonthCalendar
              countsByDate={monthCalendarCounts}
              monthCursor={currentMonth}
              onNextMonth={() => moveMonth(1)}
              onPrevMonth={() => moveMonth(-1)}
              onSelectDate={handleDateClick}
              selectedDate={activeDate}
            />
          }
          dateLabel={formatFullDate(activeDate)}
          isCalendarOpen={isCalendarOpen}
          onNextDate={() => {
            const base = new Date(`${activeDate}T00:00:00`);
            base.setDate(base.getDate() + 1);
            setSelectedDate(formatDateKey(base));
          }}
          onPrevDate={() => {
            const base = new Date(`${activeDate}T00:00:00`);
            base.setDate(base.getDate() - 1);
            setSelectedDate(formatDateKey(base));
          }}
          onToggleCalendar={toggleMobileCalendar}
        >
          <div className="record-plans-mobile__detail">
            <DayCalendarPanel
              actions={dayActions ? {
                ...dayActions,
                toggleTask: async (task) => {
                  await dayActions.toggleTask(task);
                  const isDone = task.status === "done";
                  setTasks((current) => current.map((item) => item.id === task.id ? {
                    ...item,
                    completedAt: isDone ? undefined : new Date().toISOString(),
                    status: isDone ? "todo" : "done",
                  } : item));
                },
              } : undefined}
              isLoading={isLoading}
              items={selectedTimelineItems}
            />
          </div>
        </MobileCalendarFrame>
      </div>

    </div>
  );
}
