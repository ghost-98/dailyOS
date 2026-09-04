"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { PeoplePickerField } from "@/components/shared/people/PeoplePickerField";
import { PlaceSearchField } from "@/components/shared/places/PlaceSearchField";
import { RecordCreateSheet } from "@/features/screens/record/components/RecordCreateSheet";
import { formatFullDate } from "@/features/records/time/recordDateTime";
import type { CalendarEvent } from "@/features/calendar/data";
import type { PersonRecord, PlanPlace, TaskItem } from "@/types/domain";

type PlanCreateFormProps = {
  defaultDate: string;
  kind: "event" | "task";
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onDone: () => void;
  onSaveEvent: (event: CalendarEvent) => Promise<void> | void;
  onSaveTask: (task: TaskItem) => Promise<void> | void;
  people: PersonRecord[];
};

export function PlanCreateForm({ defaultDate, kind, onClose, onCreatePerson, onDone, onSaveEvent, onSaveTask, people }: PlanCreateFormProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(false);
  const [place, setPlace] = useState<PlanPlace>();
  const [companions, setCompanions] = useState<string[]>([]);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const label = kind === "event" ? "이벤트" : "할 일";

  const save = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      if (kind === "event") {
        await onSaveEvent({
          id: `calendar-${Date.now()}`,
          date,
          type: "event",
          title: title.trim(),
          time: hasTime ? startTime || undefined : undefined,
          endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
          isAllDay: !hasTime,
          meta: memo.trim() || "메모 없음",
          expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
          companions: companions.length ? companions.join(", ") : undefined,
          place,
        });
      } else {
        await onSaveTask({
          id: `task-${Date.now()}`,
          title: title.trim(),
          status: "todo",
          priority: "normal",
          scheduledDate: date,
          startTime: hasTime ? startTime || undefined : undefined,
          endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
          isAllDay: !hasTime,
          deferredCount: 0,
          memo: memo.trim() || undefined,
          expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
          companions: companions.length ? companions.join(", ") : undefined,
          place,
        });
      }
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet
      dateLabel={formatFullDate(date)}
      onClose={onClose}
      title={`${label} 추가`}
      submit={<MobileSheetSubmitButton disabled={!title.trim() || isSaving} onClick={save}>{isSaving ? "저장 중..." : `${label} 추가`}</MobileSheetSubmitButton>}
    >
      <FormField label="날짜"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></FormField>
      <FormField label="제목"><input autoFocus placeholder={`${label} 제목`} value={title} onChange={(event) => setTitle(event.target.value)} /></FormField>
      <FormField label="시간">
        <div className="record-create-flow__time-toggles">
          <label className="planner-option-toggle"><input checked={hasTime} type="checkbox" onChange={(event) => setHasTime(event.target.checked)} /><span>시간 사용</span></label>
          <label className="planner-option-toggle"><input checked={hasTime && hasEndTime} disabled={!hasTime} type="checkbox" onChange={(event) => setHasEndTime(event.target.checked)} /><span>종료 시간 사용</span></label>
        </div>
        {hasTime ? <div className="record-create-flow__time-grid">
          <label><span>시작 시간</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          {hasEndTime ? <label><span>종료 시간</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label> : null}
        </div> : null}
      </FormField>
      <FormField label="장소"><PlaceSearchField selectedPlace={place} onSelect={setPlace} /></FormField>
      <FormField label="함께한 사람"><PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} /></FormField>
      <FormField label="지출"><input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} /></FormField>
      <FormField label="메모"><textarea placeholder="간단한 메모" value={memo} onChange={(event) => setMemo(event.target.value)} /></FormField>
    </RecordCreateSheet>
  );
}
