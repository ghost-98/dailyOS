"use client";

import { Search, Trash2, UserRound, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatWon } from "@/features/life/formatters";
import { buildPeopleSummaries } from "@/features/life/insights";
import { createPersonInDb, deletePersonFromDb, fetchPeopleFromDb, updatePersonInDb } from "@/features/people/api";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifePhotoRecord, PersonRecord, TaskItem } from "@/types/domain";
import type { CalendarEvent } from "@/features/calendar/data";

type LifePeopleViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
};

export function LifePeopleView({ activities, dailyLogs, events, expenses, photos, tasks }: LifePeopleViewProps) {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [draftName, setDraftName] = useState("");
  const [draftMemo, setDraftMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const summaries = useMemo(() => buildPeopleSummaries(events, tasks, activities, expenses, dailyLogs, photos), [activities, dailyLogs, events, expenses, photos, tasks]);
  const summaryByName = useMemo(() => new Map(summaries.map((item) => [item.name, item])), [summaries]);
  const unmanagedNames = useMemo(
    () => summaries.filter((item) => !people.some((person) => person.name === item.name)).map((item) => item.name),
    [people, summaries],
  );
  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return people.filter((person) => {
      if (!normalizedQuery) return true;
      return person.name.toLowerCase().includes(normalizedQuery) || person.memo?.toLowerCase().includes(normalizedQuery);
    });
  }, [people, query]);

  const selectedPerson = people.find((person) => person.id === selectedId) ?? filteredPeople[0] ?? null;
  const selectedSummary = selectedPerson ? summaryByName.get(selectedPerson.name) : undefined;

  useEffect(() => {
    if (!selectedId && filteredPeople[0]) setSelectedId(filteredPeople[0].id);
    if (selectedId && !people.some((person) => person.id === selectedId)) setSelectedId(filteredPeople[0]?.id ?? "");
  }, [filteredPeople, people, selectedId]);

  useEffect(() => {
    if (!selectedPerson) {
      setDraftName("");
      setDraftMemo("");
      return;
    }
    setDraftName(selectedPerson.name);
    setDraftMemo(selectedPerson.memo ?? "");
  }, [selectedPerson]);

  const resetToCreate = (name = "") => {
    setSelectedId("");
    setDraftName(name);
    setDraftMemo("");
  };

  const savePerson = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName || isSaving) return;

    setIsSaving(true);
    try {
      if (selectedPerson) {
        const updated = await updatePersonInDb({ ...selectedPerson, memo: draftMemo.trim() || undefined, name: trimmedName }, selectedPerson.name);
        if (updated) {
          setPeople((current) => current.map((person) => (person.id === updated.id ? updated : person)).sort((left, right) => left.name.localeCompare(right.name)));
          setSelectedId(updated.id);
        }
      } else {
        const created = await createPersonInDb({ memo: draftMemo.trim() || undefined, name: trimmedName });
        if (created) {
          setPeople((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
          setSelectedId(created.id);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const removePerson = async () => {
    if (!selectedPerson || isDeleting) return;
    setIsDeleting(true);
    try {
      await deletePersonFromDb(selectedPerson.id);
      setPeople((current) => current.filter((person) => person.id !== selectedPerson.id));
      setSelectedId("");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사람" description="함께한 사람을 별도로 관리하고, 관계 기록이 어디에 어떻게 쌓이는지 한곳에서 살핍니다." />
      <div className="life-people-view">
        <SectionCard className="life-people-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">People Directory</p>
              <h2>{people.length}명</h2>
            </div>
            <button className="life-people-create-button" onClick={() => resetToCreate()} type="button">
              <UserRoundPlus aria-hidden size={16} />
              <span>새 사람</span>
            </button>
          </div>

          <label className="life-people-search">
            <Search aria-hidden size={16} />
            <input placeholder="이름 또는 메모 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>

          {unmanagedNames.length > 0 ? (
            <div className="life-people-suggestions">
              <strong>기록에만 있는 사람</strong>
              <div>
                {unmanagedNames.slice(0, 8).map((name) => (
                  <button key={name} onClick={() => resetToCreate(name)} type="button">
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {filteredPeople.length > 0 ? (
            <div className="life-person-buttons">
              {filteredPeople.map((person) => {
                const summary = summaryByName.get(person.name);
                return (
                  <button className={selectedPerson?.id === person.id ? "life-person-button life-person-button--active" : "life-person-button"} key={person.id} onClick={() => setSelectedId(person.id)} type="button">
                    <strong>{person.name}</strong>
                    <span>{summary ? `${summary.items.length}회 · ${summary.places.length}곳${summary.expenseTotal > 0 ? ` · ${formatWon(summary.expenseTotal)}` : ""}` : "아직 연결된 기록 없음"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <UserRound aria-hidden size={28} />
              <strong>검색 결과가 없습니다.</strong>
              <p>이름을 새로 추가하거나 다른 검색어로 다시 찾아보세요.</p>
            </div>
          )}
        </SectionCard>

        <SectionCard className="life-people-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{selectedPerson ? "사람 상세" : "새 사람 추가"}</p>
              <h2>{selectedPerson?.name ?? "새 사람"}</h2>
            </div>
          </div>

          <div className="life-people-form">
            <label>
              <span>이름</span>
              <input placeholder="이름" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
            </label>
            <label>
              <span>메모</span>
              <textarea placeholder="관계, 특징, 기억할 메모" rows={4} value={draftMemo} onChange={(event) => setDraftMemo(event.target.value)} />
            </label>
            <div className="life-people-form__actions">
              <button className="life-people-save-button" disabled={isSaving || !draftName.trim()} onClick={() => void savePerson()} type="button">
                {isSaving ? "저장 중.." : selectedPerson ? "수정 저장" : "추가"}
              </button>
              {selectedPerson ? (
                <button className="life-people-delete-button" disabled={isDeleting} onClick={() => void removePerson()} type="button">
                  <Trash2 aria-hidden size={15} />
                  <span>{isDeleting ? "삭제 중.." : "삭제"}</span>
                </button>
              ) : null}
            </div>
          </div>

          {selectedPerson ? (
            <>
              <div className="life-people-metrics">
                <article>
                  <span>함께한 기록</span>
                  <strong>{selectedSummary?.items.length ?? 0}회</strong>
                </article>
                <article>
                  <span>간 장소</span>
                  <strong>{selectedSummary?.places.length ?? 0}곳</strong>
                </article>
                <article>
                  <span>연결 지출</span>
                  <strong>{selectedSummary && selectedSummary.expenseTotal > 0 ? formatWon(selectedSummary.expenseTotal) : "-"}</strong>
                </article>
              </div>

              <div className="life-search-results">
                {selectedSummary?.items.length ? (
                  selectedSummary.items.map((item) => (
                    <button key={item.id} type="button">
                      <span>{item.date} · {item.label}</span>
                      <strong>{item.title}</strong>
                      {item.description ? <p>{item.description}</p> : null}
                    </button>
                  ))
                ) : (
                  <div className="life-map-empty life-map-empty--compact">
                    <UserRound aria-hidden size={28} />
                    <strong>아직 연결된 기록이 없습니다.</strong>
                    <p>일정, 할 일, 활동에서 함께한 사람으로 지정하면 이곳에 쌓입니다.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
