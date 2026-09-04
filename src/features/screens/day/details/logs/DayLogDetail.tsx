import { Pencil, Trash2 } from "lucide-react";
import type { DayItemActions, DayLogItem } from "@/features/screens/day/dayDetailTypes";

type DayLogDetailProps = {
  actions?: DayItemActions;
  isLoading: boolean;
  items: DayLogItem[];
};

export function DayLogDetail({ actions, isLoading, items }: DayLogDetailProps) {
  return (
    <div className="life-calendar-day-detail">
      <div className="life-calendar-day-logs">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.id}>
              <span>{item.timeLabel}</span>
              <div className="life-calendar-day-item-heading">
                <p>{item.external.meta || item.external.title}</p>
                {actions ? <div className="life-calendar-day-item-actions">
                  <button aria-label="하루 기록 수정" onClick={() => void actions.editLog(item.external.id)} type="button"><Pencil aria-hidden size={13} /></button>
                  <button aria-label="하루 기록 삭제" onClick={() => void actions.deleteLog(item.external.id)} type="button"><Trash2 aria-hidden size={13} /></button>
                </div> : null}
              </div>
            </article>
          ))
        ) : (
          <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 하루 기록이 아직 없어요."}</div>
        )}
      </div>
    </div>
  );
}
