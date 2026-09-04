"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { confirmAction } from "@/lib/actionGuards";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/data/people/api";
import type { PersonRecord } from "@/types/domain";

export function DayPeopleView() {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [query, setQuery] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMemo, setCreateMemo] = useState("");
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

  return (
    <div className="life-tab-panel">
      <SectionCard className="life-people-list ui-workspace-panel ui-workspace-panel--tall">
        <div className="section-heading ui-panel-heading ui-panel-heading--compact life-people-list__head">
          <div className="life-people-list__title">
            <div className="life-people-list__heading">
              <p className="eyebrow">사람 목록</p>
              <strong className="life-people-list__count">{people.length}명</strong>
              <IconButton
                label={isCreateMode ? "사람 목록 닫기" : "사람 추가"}
                onClick={() => (isCreateMode ? closeCreateMode() : setIsCreateMode(true))}
                size="sm"
                tone="soft"
              >
                {isCreateMode ? <X aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
              </IconButton>
            </div>
          </div>
        </div>

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
            {filteredPeople.map((person) => (
              <article className="life-person-card" key={person.id}>
                <div className="life-person-card__main">
                  <strong>{person.name}</strong>
                  <span>{person.memo?.trim() ? person.memo : "메모 없음"}</span>
                </div>
              </article>
            ))}
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
