"use client";

import { ArrowUpDown, Check, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatWon } from "@/features/life/formatters";
import { buildPeopleSummaries } from "@/features/life/insights";
import { createPersonInDb, deletePersonFromDb, fetchPeopleFromDb, updatePersonInDb } from "@/features/people/api";
import type { CalendarEvent } from "@/features/calendar/data";
import type {
  DailyLogRecord,
  ExpenseRecord,
  LifeActivityRecord,
  LifePhotoRecord,
  PersonRecord,
  TaskItem,
} from "@/types/domain";

type LifePeopleViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
};

type PersonRecordSection = "records" | "places";
type PeopleSortMode = "recent" | "name" | "records";

export function LifePeopleView({
  activities,
  dailyLogs,
  events,
  expenses,
  photos,
  tasks,
}: LifePeopleViewProps) {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sortMode, setSortMode] = useState<PeopleSortMode>("recent");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMemo, setCreateMemo] = useState("");
  const [detailName, setDetailName] = useState("");
  const [detailMemo, setDetailMemo] = useState("");
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
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

  const summaries = useMemo(
    () => buildPeopleSummaries(events, tasks, activities, expenses, dailyLogs, photos),
    [activities, dailyLogs, events, expenses, photos, tasks],
  );

  const summaryByName = useMemo(() => new Map(summaries.map((item) => [item.name, item])), [summaries]);

  const unmanagedNames = useMemo(
    () =>
      summaries
        .filter((item) => !people.some((person) => person.name === item.name))
        .map((item) => item.name),
    [people, summaries],
  );

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const base = people.filter((person) => {
      if (!normalizedQuery) return true;
      return (
        person.name.toLowerCase().includes(normalizedQuery) ||
        person.memo?.toLowerCase().includes(normalizedQuery)
      );
    });

    return [...base].sort((left, right) => {
      const leftSummary = summaryByName.get(left.name);
      const rightSummary = summaryByName.get(right.name);
      const leftRecent = leftSummary?.items[0]?.date ?? "";
      const rightRecent = rightSummary?.items[0]?.date ?? "";
      const leftCount = leftSummary?.items.length ?? 0;
      const rightCount = rightSummary?.items.length ?? 0;

      if (sortMode === "name") return left.name.localeCompare(right.name);
      if (sortMode === "records") return rightCount - leftCount || left.name.localeCompare(right.name);
      return rightRecent.localeCompare(leftRecent) || rightCount - leftCount || left.name.localeCompare(right.name);
    });
  }, [people, query, sortMode, summaryByName]);

  const selectedPerson = filteredPeople.find((person) => person.id === selectedId) ?? filteredPeople[0] ?? null;
  const selectedSummary = selectedPerson ? summaryByName.get(selectedPerson.name) : undefined;
  const detailDirty = Boolean(
    selectedPerson &&
      (detailName.trim() !== selectedPerson.name.trim() ||
        (detailMemo.trim() || "") !== (selectedPerson.memo?.trim() || "")),
  );

  useEffect(() => {
    if (!selectedId && filteredPeople[0]) {
      setSelectedId(filteredPeople[0].id);
      return;
    }

    if (selectedId && !filteredPeople.some((person) => person.id === selectedId)) {
      setSelectedId(filteredPeople[0]?.id ?? "");
    }
  }, [filteredPeople, selectedId]);

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

  const closeCreateMode = () => {
    setIsCreateMode(false);
    setCreateName("");
    setCreateMemo("");
  };

  const openCreateMode = (presetName = "") => {
    setCreateName(presetName);
    setCreateMemo("");
    setIsCreateMode(true);
  };

  const handleCreatePerson = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName || isSavingCreate) return;

    const confirmed = window.confirm(`"${trimmedName}" 사람을 추가할까요?`);
    if (!confirmed) return;

    setIsSavingCreate(true);
    try {
      const created = await createPersonInDb({
        memo: createMemo.trim() || undefined,
        name: trimmedName,
      });

      if (!created) return;

      setPeople((current) =>
        [...current.filter((person) => person.id !== created.id), created].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setSelectedId(created.id);
      closeCreateMode();
    } finally {
      setIsSavingCreate(false);
    }
  };

  const handleUpdatePerson = async () => {
    if (!selectedPerson || isSavingDetail || !detailDirty) return;

    const trimmedName = detailName.trim();
    if (!trimmedName) return;

    const confirmed = window.confirm(`"${selectedPerson.name}" 정보를 저장할까요?`);
    if (!confirmed) return;

    setIsSavingDetail(true);
    try {
      const updated = await updatePersonInDb(
        {
          ...selectedPerson,
          memo: detailMemo.trim() || undefined,
          name: trimmedName,
        },
        selectedPerson.name,
      );

      if (!updated) return;

      setPeople((current) =>
        current
          .map((person) => (person.id === updated.id ? updated : person))
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      setSelectedId(updated.id);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleDeletePerson = async (person: PersonRecord) => {
    if (isDeletingId) return;

    const confirmed = window.confirm(
      `"${person.name}" 사람을 삭제할까요?\n연결된 기록의 함께한 사람 텍스트는 그대로 남아 있을 수 있어요.`,
    );
    if (!confirmed) return;

    setIsDeletingId(person.id);
    try {
      await deletePersonFromDb(person.id);
      setPeople((current) => current.filter((item) => item.id !== person.id));
      if (selectedId === person.id) setSelectedId("");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading
        title="사람"
        description="함께한 사람을 별도로 관리하고, 연결된 기록과 장소 흐름을 한쪽에서 바로 확인합니다."
      />

      <div className="life-people-view ui-workspace-grid ui-workspace-grid--balanced">
        <SectionCard className="life-people-list ui-workspace-panel ui-workspace-panel--tall">
          <div className="section-heading ui-panel-heading ui-panel-heading--compact">
            <div className="ui-panel-heading__intro">
              <p className="eyebrow">People Directory</p>
              <h2>{people.length}명</h2>
            </div>
            <IconButton
              label="사람 추가"
              onClick={() => (isCreateMode ? closeCreateMode() : openCreateMode())}
              tone="soft"
            >
              {isCreateMode ? <X aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
            </IconButton>
          </div>

          {isCreateMode ? (
            <div className="life-people-inline-create">
              <div className="life-people-inline-create__head">
                <strong>사람 추가</strong>
                <button className="life-people-inline-create__close" onClick={closeCreateMode} type="button">
                  닫기
                </button>
              </div>

              <div className="life-people-form">
                <label>
                  <span>이름</span>
                  <input
                    placeholder="사람 이름"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                  />
                </label>
                <label>
                  <span>메모</span>
                  <textarea
                    placeholder="관계, 특징, 기억할 메모"
                    rows={4}
                    value={createMemo}
                    onChange={(event) => setCreateMemo(event.target.value)}
                  />
                </label>
                <div className="life-people-form__actions">
                  <ActionButton disabled={isSavingCreate || !createName.trim()} onClick={() => void handleCreatePerson()}>
                    {isSavingCreate ? "추가 중..." : "사람 추가"}
                  </ActionButton>
                </div>
              </div>

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
            </div>
          ) : (
            <>
              <div className="life-people-toolbar">
                <label className="life-people-search">
                  <Search aria-hidden size={16} />
                  <input
                    placeholder="이름 또는 메모 검색"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>

                <label className="life-people-sort">
                  <ArrowUpDown aria-hidden size={14} />
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value as PeopleSortMode)}>
                    <option value="recent">최근 만남순</option>
                    <option value="records">기록 많은순</option>
                    <option value="name">이름순</option>
                  </select>
                </label>
              </div>

              {filteredPeople.length > 0 ? (
                <div className="life-person-buttons life-person-buttons--scroll">
                  {filteredPeople.map((person) => {
                    const summary = summaryByName.get(person.name);
                    const recentDate = summary?.items[0]?.date;
                    const recordCount = summary?.items.length ?? 0;
                    const placeCount = summary?.places.length ?? 0;

                    return (
                      <div
                        className={
                          selectedPerson?.id === person.id
                            ? "life-person-card life-person-card--active"
                            : "life-person-card"
                        }
                        key={person.id}
                      >
                        <button className="life-person-card__main" onClick={() => setSelectedId(person.id)} type="button">
                          <strong>{person.name}</strong>
                          <span>{recordCount > 0 ? `${recordCount}건 · ${placeCount}곳` : "아직 연결된 기록 없음"}</span>
                          <small>{recentDate ? `최근 만난 날 · ${recentDate}` : "최근 만남 기록 없음"}</small>
                        </button>

                        <div className="life-person-card__actions">
                          <IconButton label={`${person.name} 선택`} onClick={() => setSelectedId(person.id)} size="sm" tone="soft">
                            <Pencil aria-hidden size={14} />
                          </IconButton>
                          <IconButton
                            disabled={isDeletingId === person.id}
                            label={`${person.name} 삭제`}
                            onClick={() => void handleDeletePerson(person)}
                            size="sm"
                            tone="danger"
                          >
                            <Trash2 aria-hidden size={14} />
                          </IconButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="life-map-empty life-map-empty--compact">
                  <UserRound aria-hidden size={28} />
                  <strong>검색 결과가 없어요</strong>
                  <p>새 사람을 추가하거나 다른 검색어로 다시 찾아보세요.</p>
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard className="life-people-detail ui-workspace-panel ui-workspace-panel--tall">
          <div className="section-heading ui-panel-heading ui-panel-heading--compact">
            <div className="ui-panel-heading__intro">
              <p className="eyebrow">Person Detail</p>
              <h2>{selectedPerson?.name ?? "사람을 선택해 주세요"}</h2>
            </div>
            {selectedPerson ? (
              <div className="life-people-detail__actions ui-panel-heading__actions">
                <IconButton
                  disabled={!detailDirty || isSavingDetail || !detailName.trim()}
                  label="사람 정보 저장"
                  onClick={() => void handleUpdatePerson()}
                  tone="soft"
                >
                  <Check aria-hidden size={16} />
                </IconButton>
                <IconButton
                  disabled={isDeletingId === selectedPerson.id}
                  label="사람 삭제"
                  onClick={() => void handleDeletePerson(selectedPerson)}
                  tone="danger"
                >
                  <Trash2 aria-hidden size={16} />
                </IconButton>
              </div>
            ) : null}
          </div>

          {selectedPerson ? (
            <>
              <div className="life-people-form">
                <label>
                  <span>이름</span>
                  <input
                    placeholder="사람 이름"
                    value={detailName}
                    onChange={(event) => setDetailName(event.target.value)}
                  />
                </label>
                <label>
                  <span>메모</span>
                  <textarea
                    placeholder="관계, 특징, 기억할 메모"
                    rows={4}
                    value={detailMemo}
                    onChange={(event) => setDetailMemo(event.target.value)}
                  />
                </label>
              </div>

              <div className="life-people-metrics">
                <article>
                  <span>연결 기록</span>
                  <strong>{selectedSummary?.items.length ?? 0}건</strong>
                </article>
                <article>
                  <span>장소</span>
                  <strong>{selectedSummary?.places.length ?? 0}곳</strong>
                </article>
                <article>
                  <span>연결 지출</span>
                  <strong>
                    {selectedSummary && selectedSummary.expenseTotal > 0
                      ? formatWon(selectedSummary.expenseTotal)
                      : "-"}
                  </strong>
                </article>
              </div>

              <div className="life-people-collapsible">
                <button
                  className="life-people-collapsible__header"
                  onClick={() => toggleSection("records")}
                  type="button"
                >
                  <div>
                    <span>기록 상세</span>
                    <strong>함께한 기록 보기</strong>
                  </div>
                  {openSections.records ? <X aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
                </button>
                {openSections.records ? (
                  <div className="life-search-results">
                    {selectedSummary?.items.length ? (
                      selectedSummary.items.map((item) => (
                        <button key={item.id} type="button">
                          <span>
                            {item.date} · {item.label}
                          </span>
                          <strong>{item.title}</strong>
                          {item.description ? <p>{item.description}</p> : null}
                        </button>
                      ))
                    ) : (
                      <div className="life-map-empty life-map-empty--compact">
                        <UserRound aria-hidden size={28} />
                        <strong>아직 연결된 기록이 없어요</strong>
                        <p>일정, 할 일, 활동에서 함께한 사람으로 지정하면 여기에 쌓입니다.</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="life-people-collapsible">
                <button
                  className="life-people-collapsible__header"
                  onClick={() => toggleSection("places")}
                  type="button"
                >
                  <div>
                    <span>장소 흐름</span>
                    <strong>함께 간 장소 보기</strong>
                  </div>
                  {openSections.places ? <X aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
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
                      <strong>아직 연결된 장소가 없어요</strong>
                      <p>장소가 있는 일정이나 활동과 연결되면 여기에 정리됩니다.</p>
                    </div>
                  )
                ) : null}
              </div>
            </>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <UserRound aria-hidden size={28} />
              <strong>왼쪽에서 사람을 선택해 주세요</strong>
              <p>선택한 사람의 메모, 연결 기록, 장소 흐름을 여기에서 자세히 볼 수 있어요.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
