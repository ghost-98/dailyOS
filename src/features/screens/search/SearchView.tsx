"use client";

import { CalendarRange, Check, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLifeSearchItems } from "@/features/life/insights";
import { useLifeDataState } from "@/features/life/useLifeDataState";

export function SearchView() {
  const router = useRouter();
  const { data } = useLifeDataState();
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const items = useMemo(
    () => buildLifeSearchItems(data.events, data.tasks, data.activities, data.expenses, data.incomes, data.dailyLogs, data.lifePhotos, data.weights, data.workouts),
    [data.activities, data.dailyLogs, data.events, data.expenses, data.incomes, data.lifePhotos, data.tasks, data.weights, data.workouts],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const filteredItems = hasQuery
    ? items.filter((item) => {
        const matchesQuery = [item.title, item.description, item.date, item.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
        const matchesStart = !startDate || item.date >= startDate;
        const matchesEnd = !endDate || item.date <= endDate;
        return matchesQuery && matchesStart && matchesEnd;
      })
    : [];

  const resultCount = filteredItems.length;

  return (
    <div className="life-tab-panel">
      <div className="life-search-shell">
        <div className="life-search-controls life-search-controls--compact">
          <label className="life-search-controls__query">
            <Search aria-hidden size={18} />
            <input placeholder="검색어 입력" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className="life-search-period-button" aria-label="기간 설정" onClick={() => setIsPeriodOpen(true)} type="button">
            <CalendarRange aria-hidden size={16} />
          </button>
        </div>

        <div className="life-search-meta-row">
          <span>{startDate || endDate ? `${startDate || "처음"} ~ ${endDate || "현재"}` : "전체"}</span>
          <strong>{hasQuery ? `${resultCount}개` : "0개"}</strong>
        </div>

        <div className="life-search-divider" aria-hidden />

        <div className="life-search-results">
          {!hasQuery ? (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>검색어를 입력해 주세요.</strong>
              <p>검색어를 넣으면 날짜 조건에 맞는 결과만 보여드려요.</p>
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.slice(0, 80).map((item) => (
              <button key={item.id} onClick={() => router.push(`/m/day/calendar?date=${item.date}`)} type="button">
                <span>
                  {item.date} · {item.label}
                </span>
                <strong>{item.title}</strong>
                {item.description ? <p>{item.description}</p> : null}
                {item.tags.length > 0 ? <em>{item.tags.join(" · ")}</em> : null}
              </button>
            ))
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>검색 결과가 없습니다.</strong>
              <p>검색어와 기간을 바꿔 다시 찾아보세요.</p>
            </div>
          )}
        </div>

        {isPeriodOpen ? (
          <div className="life-search-period-sheet__backdrop" onClick={() => setIsPeriodOpen(false)} role="presentation">
            <section className="life-search-period-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="life-search-period-sheet__head">
                <div className="life-search-period-sheet__title">
                  <p className="eyebrow">기간 설정</p>
                </div>
                <button className="life-search-period-sheet__icon-button" onClick={() => setIsPeriodOpen(false)} type="button">
                  <X aria-hidden size={16} />
                </button>
              </div>

              <div className="life-search-period-sheet__inputs">
                <label>
                  <span>시작일</span>
                  <input aria-label="시작일" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label>
                  <span>종료일</span>
                  <input aria-label="종료일" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>

              <div className="life-search-period-sheet__actions">
                <button
                  className="life-search-period-sheet__icon-button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  type="button"
                >
                  <RotateCcw aria-hidden size={15} />
                </button>
                <button className="life-search-period-sheet__done life-search-period-sheet__done--small" onClick={() => setIsPeriodOpen(false)} type="button">
                  <Check aria-hidden size={15} />
                  <span>적용</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
