"use client";

import { ChevronDown, ChevronUp, Search, Trash2, UserRound, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatWon } from "@/features/life/formatters";
import { buildPeopleSummaries } from "@/features/life/insights";
import { createPersonInDb, deletePersonFromDb, fetchPeopleFromDb, updatePersonInDb } from "@/features/people/api";
import type { CalendarEvent } from "@/features/calendar/data";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifePhotoRecord, PersonRecord, TaskItem } from "@/types/domain";

type LifePeopleViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
};

type PersonRecordSection = "records" | "places";

export function LifePeopleView({ activities, dailyLogs, events, expenses, photos, tasks }: LifePeopleViewProps) {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [createName, setCreateName] = useState("");
  const [createMemo, setCreateMemo] = useState("");
  const [detailName, setDetailName] = useState("");
  const [detailMemo, setDetailMemo] = useState("");
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<PersonRecordSection, boolean>>({
    places: true,
    records: true,
  });

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
      setDetailName("");
      setDetailMemo("");
      return;
    }
    setDetailName(selectedPerson.name);
    setDetailMemo(selectedPerson.memo ?? "");
  }, [selectedPerson]);

  const toggleSection = (section: PersonRecordSection) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const handleCreatePerson = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName || isSavingCreate) return;

    setIsSavingCreate(true);
    try {
      const created = await createPersonInDb({ memo: createMemo.trim() || undefined, name: trimmedName });
      if (created) {
        setPeople((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
        setSelectedId(created.id);
        setCreateName("");
        setCreateMemo("");
      }
    } finally {
      setIsSavingCreate(false);
    }
  };

  const handleUpdatePerson = async () => {
    if (!selectedPerson || isSavingDetail) return;
    const trimmedName = detailName.trim();
    if (!trimmedName) return;

    setIsSavingDetail(true);
    try {
      const updated = await updatePersonInDb({ ...selectedPerson, memo: detailMemo.trim() || undefined, name: trimmedName }, selectedPerson.name);
      if (updated) {
        setPeople((current) => current.map((person) => (person.id === updated.id ? updated : person)).sort((left, right) => left.name.localeCompare(right.name)));
        setSelectedId(updated.id);
      }
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleDeletePerson = async () => {
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
      <LifeTabHeading title="사람" description="함께한 사람을 별도로 관리하고, 연결된 기록과 장소 흐름을 한 번에 살핍니다." />

      <div className="life-people-view">
        <SectionCard className="life-people-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">People Directory</p>
              <h2>{people.length}명</h2>
            </div>
          </div>

          <label className="life-people-search">
            <Search aria-hidden size={16} />
            <input placeholder="이름 또는 메모 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>

          {unmanagedNames.length > 0 ? (
            <div className="life-people-suggestions">
              <strong>기록에는 있지만 아직 등록하지 않은 사람</strong>
              <div>
                {unmanagedNames.slice(0, 8).map((name) => (
                  <button key={name} onClick={() => setCreateName(name)} type="button">
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
              <strong>검색 결과가 없어요.</strong>
              <p>새 사람을 추가하거나 다른 검색어로 다시 찾아보세요.</p>
            </div>
          )}
        </SectionCard>

        <div className="life-people-side">
          <SectionCard className="life-people-create">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Create Person</p>
                <h2>사람 추가</h2>
              </div>
              <span className="life-people-badge">
                <UserRoundPlus aria-hidden size={14} />
                직접 등록
              </span>
            </div>

            <div className="life-people-form">
              <label>
                <span>이름</span>
                <input placeholder="이름" value={createName} onChange={(event) => setCreateName(event.target.value)} />
              </label>
              <label>
                <span>메모</span>
                <textarea placeholder="관계, 특징, 기억할 메모" rows={4} value={createMemo} onChange={(event) => setCreateMemo(event.target.value)} />
              </label>
              <div className="life-people-form__actions">
                <button className="life-people-save-button" disabled={isSavingCreate || !createName.trim()} onClick={() => void handleCreatePerson()} type="button">
                  {isSavingCreate ? "추가 중..." : "사람 추가"}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="life-people-detail">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Person Detail</p>
                <h2>{selectedPerson?.name ?? "사람을 선택하세요"}</h2>
              </div>
            </div>

            {selectedPerson ? (
              <>
                <div className="life-people-form">
                  <label>
                    <span>이름</span>
                    <input placeholder="이름" value={detailName} onChange={(event) => setDetailName(event.target.value)} />
                  </label>
                  <label>
                    <span>메모</span>
                    <textarea placeholder="관계, 특징, 기억할 메모" rows={4} value={detailMemo} onChange={(event) => setDetailMemo(event.target.value)} />
                  </label>
                  <div className="life-people-form__actions">
                    <button className="life-people-save-button" disabled={isSavingDetail || !detailName.trim()} onClick={() => void handleUpdatePerson()} type="button">
                      {isSavingDetail ? "저장 중..." : "상세 저장"}
                    </button>
                    <button className="life-people-delete-button" disabled={isDeleting} onClick={() => void handleDeletePerson()} type="button">
                      <Trash2 aria-hidden size={15} />
                      <span>{isDeleting ? "삭제 중..." : "삭제"}</span>
                    </button>
                  </div>
                </div>

                <div className="life-people-metrics">
                  <article>
                    <span>함께한 기록</span>
                    <strong>{selectedSummary?.items.length ?? 0}회</strong>
                  </article>
                  <article>
                    <span>장소</span>
                    <strong>{selectedSummary?.places.length ?? 0}곳</strong>
                  </article>
                  <article>
                    <span>연결 지출</span>
                    <strong>{selectedSummary && selectedSummary.expenseTotal > 0 ? formatWon(selectedSummary.expenseTotal) : "-"}</strong>
                  </article>
                </div>

                <div className="life-people-collapsible">
                  <button className="life-people-collapsible__header" onClick={() => toggleSection("records")} type="button">
                    <div>
                      <span>기록 상세</span>
                      <strong>함께한 기록 펼치기</strong>
                    </div>
                    {openSections.records ? <ChevronUp aria-hidden size={18} /> : <ChevronDown aria-hidden size={18} />}
                  </button>
                  {openSections.records ? (
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
                          <strong>아직 연결된 기록이 없어요.</strong>
                          <p>일정, 할 일, 활동에서 함께한 사람으로 지정하면 여기에 쌓입니다.</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="life-people-collapsible">
                  <button className="life-people-collapsible__header" onClick={() => toggleSection("places")} type="button">
                    <div>
                      <span>장소 흐름</span>
                      <strong>함께 간 장소 펼치기</strong>
                    </div>
                    {openSections.places ? <ChevronUp aria-hidden size={18} /> : <ChevronDown aria-hidden size={18} />}
                  </button>
                  {openSections.places ? (
                    selectedSummary?.places.length ? (
                      <div className="life-people-places">
                        {Array.from(new Set(selectedSummary.places)).map((place) => (
                          <span key={place}>{place}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="life-map-empty life-map-empty--compact">
                        <UserRound aria-hidden size={28} />
                        <strong>아직 연결된 장소가 없어요.</strong>
                        <p>장소가 연결된 일정이나 활동이 생기면 여기에 정리됩니다.</p>
                      </div>
                    )
                  ) : null}
                </div>
              </>
            ) : (
              <div className="life-map-empty life-map-empty--compact">
                <UserRound aria-hidden size={28} />
                <strong>왼쪽에서 사람을 선택해 주세요.</strong>
                <p>선택한 사람의 메모, 함께한 기록, 장소 흐름을 여기서 자세히 볼 수 있어요.</p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
