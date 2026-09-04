"use client";

import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";

type MobileCalendarFrameProps = {
  calendar?: ReactNode;
  children: ReactNode;
  className?: string;
  dateLabel: string;
  isCalendarOpen: boolean;
  onNextDate: () => void;
  onPrevDate: () => void;
  onToggleCalendar: () => void;
  title?: string;
};

export function MobileCalendarFrame({
  calendar,
  children,
  className,
  dateLabel,
  isCalendarOpen,
  onNextDate,
  onPrevDate,
  onToggleCalendar,
  title,
}: MobileCalendarFrameProps) {
  return (
    <SectionCard className={className ? `mobile-record-frame ${className}` : "mobile-record-frame"}>
      {title ? <p className="mobile-record-frame__eyebrow">{title}</p> : null}
      <div className="mobile-record-frame__topbar">
        <IconButton className="mobile-record-frame__nav" label="이전 날짜" onClick={onPrevDate} size="sm" tone="outline">
          <ChevronLeft aria-hidden size={16} />
        </IconButton>
        <button className="mobile-record-frame__date" onClick={onToggleCalendar} type="button">
          <strong>{dateLabel}</strong>
        </button>
        <div className="mobile-record-frame__actions">
          <IconButton className="mobile-record-frame__nav" label="다음 날짜" onClick={onNextDate} size="sm" tone="outline">
            <ChevronRight aria-hidden size={16} />
          </IconButton>
          <IconButton label={isCalendarOpen ? "달력 접기" : "달력 펼치기"} onClick={onToggleCalendar} size="sm" tone="outline">
            <CalendarDays aria-hidden size={16} />
          </IconButton>
        </div>
      </div>
      {isCalendarOpen && calendar ? <div className="mobile-record-frame__calendar">{calendar}</div> : null}
      {children}
    </SectionCard>
  );
}



