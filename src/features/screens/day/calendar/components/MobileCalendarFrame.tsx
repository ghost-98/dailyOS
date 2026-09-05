"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

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
  const gestureRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"next" | "prev" | null>(null);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const animate = (direction: "next" | "prev", action: () => void) => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }
    setSwipeDirection(direction);
    action();
    animationTimerRef.current = window.setTimeout(() => {
      setSwipeDirection(null);
      animationTimerRef.current = null;
    }, 220);
  };

  const beginGesture = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, label")) return;
    gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const endGesture = (event: PointerEvent<HTMLElement>) => {
    const start = gestureRef.current;
    if (!start || start.id !== event.pointerId) return;
    gestureRef.current = null;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;

    if (deltaX > 0) animate("prev", onPrevDate);
    else animate("next", onNextDate);
  };

  return (
    <div
      className={className ? `mobile-record-frame ${className} ${swipeDirection ? `mobile-record-frame--swipe-${swipeDirection}` : ""}`.trim() : `mobile-record-frame ${swipeDirection ? `mobile-record-frame--swipe-${swipeDirection}` : ""}`.trim()}
      onPointerDown={beginGesture}
      onPointerLeave={() => {
        gestureRef.current = null;
      }}
      onPointerCancel={() => {
        gestureRef.current = null;
      }}
      onPointerUp={endGesture}
      style={{ touchAction: "pan-y" }}
    >
      <div className={`mobile-record-frame__motion ${swipeDirection ? `mobile-record-frame__motion--${swipeDirection}` : ""}`.trim()}>
        {title ? <p className="mobile-record-frame__eyebrow">{title}</p> : null}
        <div className="mobile-record-frame__topbar">
          <IconButton className="mobile-record-frame__nav" label="이전 날짜" onClick={() => animate("prev", onPrevDate)} size="sm" tone="outline">
            <ChevronLeft aria-hidden size={16} />
          </IconButton>
          <button className="mobile-record-frame__date" onClick={onToggleCalendar} type="button">
            <strong>{dateLabel}</strong>
          </button>
          <div className="mobile-record-frame__actions">
            <IconButton className="mobile-record-frame__nav" label="다음 날짜" onClick={() => animate("next", onNextDate)} size="sm" tone="outline">
              <ChevronRight aria-hidden size={16} />
            </IconButton>
            <IconButton label={isCalendarOpen ? "달력 접기" : "달력 펼치기"} onClick={onToggleCalendar} size="sm" tone="outline">
              <CalendarDays aria-hidden size={16} />
            </IconButton>
          </div>
        </div>
        {isCalendarOpen && calendar ? <div className="mobile-record-frame__calendar">{calendar}</div> : null}
        {children}
      </div>
    </div>
  );
}



