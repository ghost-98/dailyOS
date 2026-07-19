"use client";

import { CalendarDays, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { CalendarView } from "@/features/calendar/CalendarView";
import { TodayDashboard } from "./TodayDashboard";

type TodayMode = "dashboard" | "calendar";

const viewText = {
  aria: "\uC624\uB298 \uD654\uBA74 \uBCF4\uAE30 \uBC29\uC2DD",
  dashboard: "\uB300\uC2DC\uBCF4\uB4DC",
  calendar: "\uCEA8\uB9B0\uB354",
  plan: "\uACC4\uD68D",
};

export function TodayView() {
  const [mode, setMode] = useState<TodayMode>("dashboard");

  return (
    <div className="today-home">
      <div className="today-mode-tabs" aria-label={viewText.aria}>
        <button className={mode === "dashboard" ? "today-mode-tabs__item today-mode-tabs__item--active" : "today-mode-tabs__item"} onClick={() => setMode("dashboard")} type="button">
          <LayoutDashboard aria-hidden size={18} />
          {viewText.dashboard}
        </button>
        <button className={mode === "calendar" ? "today-mode-tabs__item today-mode-tabs__item--active" : "today-mode-tabs__item"} onClick={() => setMode("calendar")} type="button">
          <CalendarDays aria-hidden size={18} />
          {viewText.calendar}
        </button>
      </div>

      {mode === "dashboard" ? (
        <TodayDashboard />
      ) : (
        <CalendarView
          showEventAddButton
          title={viewText.plan}
        />
      )}
    </div>
  );
}
