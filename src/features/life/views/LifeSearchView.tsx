"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { buildLifeSearchItems } from "@/features/life/insights";
import type { LifeSearchItem } from "@/features/life/insights";
import type { CalendarEvent } from "@/features/calendar/data";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type LifeSearchViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  onOpenDate: (date: string) => void;
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

export function LifeSearchView({
  activities,
  dailyLogs,
  events,
  expenses,
  incomes,
  onOpenDate,
  photos,
  tasks,
  weights,
  workouts,
}: LifeSearchViewProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LifeSearchItem["type"]>("all");
  const items = useMemo(() => buildLifeSearchItems(events, tasks, activities, expenses, incomes, dailyLogs, photos, weights, workouts), [activities, dailyLogs, events, expenses, incomes, photos, tasks, weights, workouts]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesQuery = !normalizedQuery || [item.title, item.description, item.date, item.tags.join(" ")].join(" ").toLowerCase().includes(normalizedQuery);
    return matchesType && matchesQuery;
  });

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="전체 검색" description="사람, 장소, 금액, 메모, 사진명, 날짜를 한 번에 찾아 전체 인생 DB를 탐색합니다." />
      <SectionCard className="life-report-panel">
        <div className="life-search-controls">
          <label>
            <Search aria-hidden size={18} />
            <input placeholder="예: 강남, 민수, 러닝, 50000, 면접" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | LifeSearchItem["type"])}>
            <option value="all">전체</option>
            <option value="schedule">일정</option>
            <option value="todo">할일</option>
            <option value="event">이벤트</option>
            <option value="activity">활동</option>
            <option value="expense">지출</option>
            <option value="income">수입</option>
            <option value="daily_log">하루기록</option>
            <option value="photo">사진</option>
            <option value="workout">운동</option>
            <option value="weight">몸무게</option>
          </select>
        </div>

        <div className="life-search-result-head">
          <strong>{filteredItems.length}개 결과</strong>
          <span>전체 {items.length}개 기록 중 검색</span>
        </div>

        <div className="life-search-results">
          {filteredItems.slice(0, 80).map((item) => (
            <button key={item.id} onClick={() => onOpenDate(item.date)} type="button">
              <span>{item.date} · {item.label}</span>
              <strong>{item.title}</strong>
              {item.description ? <p>{item.description}</p> : null}
              {item.tags.length > 0 ? <em>{item.tags.join(" · ")}</em> : null}
            </button>
          ))}
          {filteredItems.length === 0 ? (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>검색 결과가 없습니다.</strong>
              <p>장소, 사람, 메모, 금액, 사진 이름 같은 단어로 다시 검색해보세요.</p>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
