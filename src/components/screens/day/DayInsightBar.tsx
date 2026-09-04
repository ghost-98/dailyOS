"use client";

import type { LucideIcon } from "lucide-react";

export type DayInsightButton = {
  active?: boolean;
  count: number;
  icon: LucideIcon;
  key: string;
  label: string;
  onClick: () => void;
};

type DayInsightBarProps = {
  buttons: DayInsightButton[];
};

export function DayInsightBar({ buttons }: DayInsightBarProps) {
  return (
    <div className="life-calendar-day-insight-bar" role="group" aria-label="하루 요약">
      {buttons.map((button) => {
        const Icon = button.icon;
        const isActive = Boolean(button.active);

        return (
          <button
            aria-label={button.label}
            className={isActive ? "life-calendar-day-insight-bar__button life-calendar-day-insight-bar__button--active" : "life-calendar-day-insight-bar__button"}
            key={button.key}
            onClick={button.onClick}
            title={button.label}
            type="button"
          >
            <Icon aria-hidden size={20} />
            <span className="life-calendar-day-insight-bar__count" aria-hidden>
              {button.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

