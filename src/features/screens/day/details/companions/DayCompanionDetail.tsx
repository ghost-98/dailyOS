import { UsersRound } from "lucide-react";
import type { DayCounterItem } from "@/features/screens/day/dayDetailTypes";

type DayCompanionDetailProps = {
  isLoading: boolean;
  items: DayCounterItem[];
};

export function DayCompanionDetail({ isLoading, items }: DayCompanionDetailProps) {
  if (items.length === 0) {
    return <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 함께한 사람 기록이 아직 없어요."}</div>;
  }

  return (
    <div className="life-calendar-day-detail life-calendar-day-companions">
      {items.map((item) => (
        <article className="life-calendar-day-companions__item" key={item.value}>
          <span className="life-calendar-day-companions__avatar" aria-hidden>
            {getInitial(item.value)}
          </span>
          <div>
            <strong>{item.value}</strong>
            <span>함께한 기록</span>
          </div>
          <b>
            <UsersRound aria-hidden size={14} />
            {item.count}회
          </b>
        </article>
      ))}
    </div>
  );
}

function getInitial(name: string) {
  return Array.from(name.trim())[0] ?? "?";
}
