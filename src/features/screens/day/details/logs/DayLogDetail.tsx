import type { DayLogItem } from "@/features/screens/day/dayDetailTypes";

type DayLogDetailProps = {
  isLoading: boolean;
  items: DayLogItem[];
};

export function DayLogDetail({ isLoading, items }: DayLogDetailProps) {
  return (
    <div className="life-calendar-day-detail">
      <div className="life-calendar-day-logs">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.id}>
              <span>{item.timeLabel}</span>
              <p>{item.external.meta || item.external.title}</p>
            </article>
          ))
        ) : (
          <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 하루 기록이 아직 없어요."}</div>
        )}
      </div>
    </div>
  );
}
