"use client";

import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";

type MobileRecordFrameProps = {
  addButtonLabel: string;
  addMenu?: ReactNode;
  calendar?: ReactNode;
  children: ReactNode;
  className?: string;
  countLabel?: string;
  countValue?: string;
  dateLabel: string;
  dateSubLabel?: string;
  isAddMenuOpen?: boolean;
  isCalendarOpen: boolean;
  onAddClick: () => void;
  onNextDate: () => void;
  onPrevDate: () => void;
  onToggleCalendar: () => void;
  summary?: ReactNode;
  showAddButton?: boolean;
  title?: string;
};

export function MobileRecordFrame({
  addButtonLabel,
  addMenu,
  calendar,
  children,
  className,
  countLabel,
  countValue,
  dateLabel,
  dateSubLabel,
  isAddMenuOpen = false,
  isCalendarOpen,
  onAddClick,
  onNextDate,
  onPrevDate,
  onToggleCalendar,
  summary,
  showAddButton = true,
  title,
}: MobileRecordFrameProps) {
  return (
    <SectionCard className={className ? `mobile-record-frame ${className}` : "mobile-record-frame"}>
      {title ? <p className="mobile-record-frame__eyebrow">{title}</p> : null}
      <div className="mobile-record-frame__topbar">
        <IconButton className="mobile-record-frame__nav" label="이전 날짜" onClick={onPrevDate} size="sm" tone="outline">
          <ChevronLeft aria-hidden size={16} />
        </IconButton>
        <button className="mobile-record-frame__date" onClick={onToggleCalendar} type="button">
          <strong>{dateLabel}</strong>
          {dateSubLabel ? <span>{dateSubLabel}</span> : countLabel && countValue ? <span>{`${countLabel} · ${countValue}`}</span> : null}
        </button>
        <div className="mobile-record-frame__actions">
          <IconButton className="mobile-record-frame__nav" label="다음 날짜" onClick={onNextDate} size="sm" tone="outline">
            <ChevronRight aria-hidden size={16} />
          </IconButton>
          <IconButton label={isCalendarOpen ? "달력 접기" : "달력 펼치기"} onClick={onToggleCalendar} size="sm" tone="outline">
            <CalendarDays aria-hidden size={16} />
          </IconButton>
          {showAddButton ? (
            <IconButton className="mobile-record-frame__add" label={addButtonLabel} onClick={onAddClick} size="sm">
              <Plus aria-hidden size={16} />
            </IconButton>
          ) : null}
        </div>
      </div>
      {isAddMenuOpen && addMenu ? <div className="mobile-record-frame__menu">{addMenu}</div> : null}
      {isCalendarOpen && calendar ? <div className="mobile-record-frame__calendar">{calendar}</div> : null}
      {summary ? <div className="mobile-record-frame__summary">{summary}</div> : null}
      {children}
    </SectionCard>
  );
}
