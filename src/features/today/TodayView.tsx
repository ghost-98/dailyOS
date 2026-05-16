"use client";

import { CalendarDays, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { CalendarView } from "@/features/calendar/CalendarView";
import { TodayDashboard } from "./TodayDashboard";

type TodayMode = "dashboard" | "calendar";

export function TodayView() {
  const [mode, setMode] = useState<TodayMode>("dashboard");

  return (
    <div className="today-home">
      <div className="today-mode-tabs" aria-label="오늘 화면 보기 방식">
        <button className={mode === "dashboard" ? "today-mode-tabs__item today-mode-tabs__item--active" : "today-mode-tabs__item"} onClick={() => setMode("dashboard")} type="button">
          <LayoutDashboard aria-hidden size={18} />
          대시보드
        </button>
        <button className={mode === "calendar" ? "today-mode-tabs__item today-mode-tabs__item--active" : "today-mode-tabs__item"} onClick={() => setMode("calendar")} type="button">
          <CalendarDays aria-hidden size={18} />
          캘린더
        </button>
      </div>

      {mode === "dashboard" ? (
        <TodayDashboard />
      ) : (
        <CalendarView
          description="일정, 이벤트, 할 일을 달력으로 확인합니다."
          showEventAddButton
          title="계획"
        />
      )}
    </div>
  );
}
