import type { ReactNode } from "react";
import { CalendarRange } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

type PeriodSummaryBarProps = {
  count: number;
  countUnit: string;
  endDate: string;
  onOpenPeriod: () => void;
  startDate: string;
  actions?: ReactNode;
};

export function PeriodSummaryBar({ actions, count, countUnit, endDate, onOpenPeriod, startDate }: PeriodSummaryBarProps) {
  const periodLabel = startDate || endDate
    ? `${startDate || "처음"} ~ ${endDate || "현재"}`
    : "전체";

  return (
    <div className="period-summary-bar">
      <div className="period-summary-bar__summary">
        <span>{periodLabel}</span>
        <strong>{count}{countUnit}</strong>
      </div>
      <div className="period-summary-bar__actions">
        {actions}
        <IconButton label="기간 설정" onClick={onOpenPeriod} size="sm" tone="soft">
          <CalendarRange aria-hidden size={16} />
        </IconButton>
      </div>
    </div>
  );
}
