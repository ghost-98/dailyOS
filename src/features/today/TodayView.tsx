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
      <div className="today-mode-tabs" aria-label="오늘 화면 모드">
        <button className={mode === "dashboard" ? "today-mode-tabs__item today-mode-tabs__item--active" : "today-mode-tabs__item"} onClick={() => setMode("dashboard")}>
          <LayoutDashboard aria-hidden size={18} />
          대시보드
        </button>
        <button className={mode === "calendar" ? "today-mode-tabs__item today-mode-tabs__item--active" : "today-mode-tabs__item"} onClick={() => setMode("calendar")}>
          <CalendarDays aria-hidden size={18} />
          캘린더
        </button>
      </div>

      {mode === "dashboard" ? (
        <TodayDashboard />
      ) : (
        <CalendarView
          addButtonLabel="일정 추가"
          description="오늘 탭 안에서 전체 날짜 흐름을 함께 확인합니다."
          title="캘린더"
        />
      )}
    </div>
  );
}
