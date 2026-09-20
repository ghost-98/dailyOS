"use client";

import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { PanelHeading } from "@/components/ui/PanelHeading";
import { SectionCard } from "@/components/ui/SectionCard";
import { confirmAction } from "@/lib/actionGuards";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/data/people/api";
import { formatWon } from "@/features/records/format/recordFormatters";
import { buildRecordPeopleSummaries } from "@/features/records/search/recordsInsights";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import type { PersonRecord } from "@/types/domain";
import { createDayRecordHref } from "@/features/records/navigation/recordDeepLink";

export function PeopleView() {
  const router = useRouter();
  const { data } = useRecordsDataState();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [query, setQuery] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMemo, setCreateMemo] = useState("");
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchPeopleFromDb()
      .then((records) => {
        if (!isMounted) return;
        setPeople(records ?? []);
      })
      .catch((error) => console.error("Failed to load people list", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return people;

    return people.filter((person) => {
      return (
        person.name.toLowerCase().includes(normalizedQuery) ||
        (person.memo ?? "").toLowerCase().includes(normalizedQuery) ||
        false
      );
    });
  }, [people, query]);

  const peopleSummaryByName = useMemo(() => {
    const summaries = buildRecordPeopleSummaries(data.events, data.tasks, data.activities, data.expenses, data.dailyLogs, data.lifePhotos);
    return new Map(summaries.map((summary) => [summary.name, summary]));
  }, [data.activities, data.dailyLogs, data.events, data.expenses, data.lifePhotos, data.tasks]);

  const closeCreateMode = () => {
    setIsCreateMode(false);
    setCreateName("");
    setCreateMemo("");
  };

  const handleCreatePerson = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName || isSavingCreate) return;

    const confirmed = confirmAction(`"${trimmedName}" 사람을 추가할까요?`);
    if (!confirmed) return;

    setIsSavingCreate(true);
    try {
      const created = await createPersonInDb({
        memo: createMemo.trim() || undefined,
        name: trimmedName,
      });

      if (!created) return;

      setPeople((current) => [...current.filter((person) => person.id !== created.id), created].sort((left, right) => left.name.localeCompare(right.name)));
      closeCreateMode();
    } finally {
      setIsSavingCreate(false);
    }
  };

  const togglePerson = (personId: string) => {
    setExpandedPersonId((current) => (current === personId ? null : personId));
  };

  return (
    <div className="life-tab-panel">
      <SectionCard className="life-people-list ui-workspace-panel ui-workspace-panel--tall">
        <PanelHeading
          actions={(
            <IconButton
              label={isCreateMode ? "사람 목록 닫기" : "사람 추가"}
              onClick={() => (isCreateMode ? closeCreateMode() : setIsCreateMode(true))}
              size="sm"
              tone="soft"
            >
              {isCreateMode ? <X aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
            </IconButton>
          )}
          meta={<strong className="life-people-list__count">{people.length}명</strong>}
          title="사람 목록"
        />

        {isCreateMode ? (
          <div className="life-people-inline-create">
            <div className="life-people-form">
              <FormField label="이름">
                <input
                  placeholder="사람 이름"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                />
              </FormField>
              <FormField label="메모">
                <textarea
                  placeholder="관계, 특징, 기억할 메모"
                  rows={4}
                  value={createMemo}
                  onChange={(event) => setCreateMemo(event.target.value)}
                />
              </FormField>
              <div className="life-people-form__actions">
                <ActionButton disabled={isSavingCreate || !createName.trim()} onClick={() => void handleCreatePerson()}>
                  {isSavingCreate ? "추가 중..." : "사람 추가"}
                </ActionButton>
              </div>
            </div>
          </div>
        ) : null}

        <div className="life-people-toolbar">
          <label className="life-people-search ui-input-shell">
            <Search aria-hidden size={16} />
            <input
              placeholder="이름 또는 메모 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {filteredPeople.length > 0 ? (
          <div className="life-person-buttons life-person-buttons--scroll">
            {filteredPeople.map((person) => {
              const isExpanded = expandedPersonId === person.id;
              const summary = peopleSummaryByName.get(person.name);
              const recentItem = summary?.items[0];
              const topPlaces = summary?.places.slice(0, 3) ?? [];

              return (
              <article className={`life-person-card ${isExpanded ? "life-person-card--expanded" : ""}`} key={person.id}>
                <button
                  aria-expanded={isExpanded}
                  className="life-person-card__summary"
                  onClick={() => togglePerson(person.id)}
                  type="button"
                >
                  <span aria-hidden className="life-person-card__avatar">{getPersonInitial(person.name)}</span>
                  <span className="life-person-card__main">
                    <strong>{person.name}</strong>
                    <span>{person.memo?.trim() || "메모 없음"}</span>
                  </span>
                  <ChevronDown aria-hidden className="life-person-card__chevron" size={15} />
                </button>
                <div aria-hidden={!isExpanded} className="life-person-card__details">
                  <div className="life-person-card__details-inner">
                    <div className="life-person-card__metric-grid">
                      <span><b>{summary?.items.length ?? 0}</b><small>함께한 수</small></span>
                      <span><b>{summary?.photos.length ?? 0}</b><small>사진</small></span>
                      <span><b>{summary?.logs.length ?? 0}</b><small>기록</small></span>
                    </div>
                    <div className="life-person-card__detail-copy">
                      <b>최근</b>
                      {recentItem?.focusId ? (
                        <button className="life-person-card__record-link" onClick={() => router.push(createDayRecordHref(recentItem.date, recentItem.focusId!))} type="button">
                          {recentItem.date} · {recentItem.title}
                        </button>
                      ) : <p>아직 연결된 활동이 없습니다.</p>}
                    </div>
                    <div className="life-person-card__detail-copy">
                      <b>자주 나온 장소</b>
                      <p>{topPlaces.length > 0 ? topPlaces.join(" · ") : "장소 기록이 아직 없습니다."}</p>
                    </div>
                    <div className="life-person-card__detail-copy">
                      <b>메모</b>
                      <p>{person.memo?.trim() || "아직 저장된 메모가 없습니다."}</p>
                    </div>
                    {summary && summary.expenseTotal > 0 ? <p className="life-person-card__expense">연결 지출 {formatWon(summary.expenseTotal)}</p> : null}
                  </div>
                </div>
              </article>
            );
            })}
          </div>
        ) : (
          <div className="life-map-empty life-map-empty--compact">
            <Search aria-hidden size={28} />
            <strong>검색 결과가 없어요</strong>
            <p>다른 검색어로 다시 찾아보거나 새 사람을 추가해 주세요.</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function getPersonInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}
