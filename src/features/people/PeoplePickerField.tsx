"use client";

import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { PersonRecord } from "@/types/domain";

type PeoplePickerFieldProps = {
  onChange: (names: string[]) => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  people: PersonRecord[];
  selectedNames: string[];
};

export function PeoplePickerField({ onChange, onCreatePerson, people, selectedNames }: PeoplePickerFieldProps) {
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = useMemo(
    () =>
      people.filter((person) => {
        if (selectedNames.includes(person.name)) return false;
        if (!normalizedQuery) return false;
        return person.name.toLowerCase().includes(normalizedQuery) || person.memo?.toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, people, selectedNames],
  );

  const canCreate =
    normalizedQuery.length > 0 &&
    !people.some((person) => person.name.toLowerCase() === normalizedQuery) &&
    !selectedNames.some((name) => name.toLowerCase() === normalizedQuery);

  const addName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || selectedNames.includes(trimmedName)) return;
    onChange([...selectedNames, trimmedName]);
    setQuery("");
  };

  const removeName = (name: string) => {
    onChange(selectedNames.filter((item) => item !== name));
  };

  const createName = async () => {
    const nextName = query.trim();
    if (!nextName) return;
    setIsCreating(true);
    try {
      const person = await onCreatePerson(nextName);
      addName(person?.name ?? nextName);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="people-picker">
      <div className="people-picker__selected">
        {selectedNames.length > 0 ? (
          selectedNames.map((name) => (
            <button className="people-picker__chip" key={name} onClick={() => removeName(name)} type="button">
              <span>{name}</span>
              <X aria-hidden size={13} />
            </button>
          ))
        ) : (
          <p className="people-picker__empty">아직 선택한 사람이 없습니다.</p>
        )}
      </div>

      <label className="people-picker__search ui-input-shell">
        <Search aria-hidden size={15} />
        <input placeholder="사람 검색 또는 새 이름 입력" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <div className="people-picker__results">
        {canCreate ? (
          <button className="people-picker__create" disabled={isCreating} onClick={() => void createName()} type="button">
            <Plus aria-hidden size={14} />
            {isCreating ? "추가 중..." : `"${query.trim()}" 추가`}
          </button>
        ) : null}

        {suggestions.slice(0, 8).map((person) => (
          <button className="people-picker__option" key={person.id} onClick={() => addName(person.name)} type="button">
            <strong>{person.name}</strong>
            {person.memo ? <span>{person.memo}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
