"use client";

import { Banknote, CalendarRange, Camera, CheckCircle2, Clock, Dumbbell, MapPin, NotebookPen, Search, Tag, UsersRound, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PeriodFilterSheet } from "@/components/shared/date/PeriodFilterSheet";
import { buildRecordSearchItems, type RecordSearchFactKind } from "@/features/records/search/recordSearchItems";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { createDayRecordHref } from "@/features/records/navigation/recordDeepLink";

export function KeywordSearchPanel() {
  const router = useRouter();
  const { data } = useRecordsDataState();
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const items = useMemo(
    () => buildRecordSearchItems(data.events, data.tasks, data.activities, data.expenses, data.incomes, data.dailyLogs, data.lifePhotos, data.weights, data.workouts),
    [data.activities, data.dailyLogs, data.events, data.expenses, data.incomes, data.lifePhotos, data.tasks, data.weights, data.workouts],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const hasFilters = Boolean(normalizedQuery || startDate || endDate);
  const filteredItems = hasFilters ? items.filter((item) => {
    if ((startDate && item.date < startDate) || (endDate && item.date > endDate)) return false;
    if (!normalizedQuery) return true;
    const text = [item.title, item.description, item.date, item.tags.join(" "), item.facts?.map((fact) => fact.text).join(" ")].join(" ").toLowerCase();
    return text.includes(normalizedQuery);
  }) : [];

  return (
    <>
      <div className="life-search-controls life-search-controls--compact">
        <label className="life-search-controls__query">
          <Search aria-hidden size={18} />
          <input aria-label="검색어" placeholder="검색어 입력" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button className="life-search-period-button" aria-label="기간 설정" onClick={() => setIsPeriodOpen(true)} type="button">
          <CalendarRange aria-hidden size={16} />
        </button>
      </div>
      {hasFilters && <div className="life-search-meta-row">
        {(startDate || endDate) && <span>{startDate || "처음"} ~ {endDate || "현재"}</span>}
        <strong>{filteredItems.length}개</strong>
      </div>}
      <div className="life-search-results">
        {!hasFilters ? null : filteredItems.length > 0 ? filteredItems.slice(0, 80).map((item) => (
          <button className={`life-search-result life-search-result--${item.type}`} key={item.id} onClick={() => router.push(createDayRecordHref(item.date, item.id))} type="button">
            <span className="life-search-result__head">
              <span className="life-search-result__title">
                <strong>{item.title}</strong>
                <span className="life-search-result__meta"><time>{item.date}</time><b>{item.label}</b></span>
              </span>
            </span>
            {item.facts?.length ? (
              <span className="life-search-result__facts">
                {item.facts.slice(0, 5).map((fact) => {
                  const Icon = searchFactIcons[fact.kind];
                  return <small key={`${fact.kind}-${fact.text}`}><Icon aria-hidden size={13} /><span>{fact.text}</span></small>;
                })}
              </span>
            ) : null}
          </button>
        )) : (
          <div className="life-map-empty life-map-empty--compact">
            <Search aria-hidden size={28} />
            <strong>검색 결과가 없습니다.</strong>
          </div>
        )}
      </div>
      <PeriodFilterSheet endDate={endDate} isOpen={isPeriodOpen} onClose={() => setIsPeriodOpen(false)} onEndDateChange={setEndDate} onReset={() => { setStartDate(""); setEndDate(""); }} onStartDateChange={setStartDate} startDate={startDate} />
    </>
  );
}

const searchFactIcons: Record<RecordSearchFactKind, typeof Search> = {
  food: UtensilsCrossed,
  memo: NotebookPen,
  money: Banknote,
  people: UsersRound,
  photo: Camera,
  place: MapPin,
  status: CheckCircle2,
  tag: Tag,
  time: Clock,
  workout: Dumbbell,
};
