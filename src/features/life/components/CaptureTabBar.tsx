"use client";

import { Activity, CalendarCheck2, HeartPulse, NotebookPen } from "lucide-react";

const tabs = [
  { icon: Activity, label: "활동", value: "activities" },
  { icon: CalendarCheck2, label: "할 일", value: "plans" },
  { icon: NotebookPen, label: "메모", value: "logs" },
  { icon: HeartPulse, label: "건강", value: "health" },
] as const;

type CaptureTab = (typeof tabs)[number]["value"];

export function CaptureTabBar({
  activeTab,
  onChange,
}: {
  activeTab: CaptureTab;
  onChange: (tab: CaptureTab) => void;
}) {
  return (
    <nav aria-label="기록 탭" className="capture-tab-bar" role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.value;

        return (
          <button
            aria-selected={isActive}
            className={isActive ? "capture-tab-bar__item capture-tab-bar__item--active" : "capture-tab-bar__item"}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden size={15} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export type { CaptureTab };
