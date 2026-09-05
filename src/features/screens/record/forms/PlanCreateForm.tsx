"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { PeoplePickerField } from "@/components/shared/people/PeoplePickerField";
import { PlaceSearchField } from "@/components/shared/places/PlaceSearchField";
import { RecordCreateSheet } from "@/features/screens/record/components/RecordCreateSheet";
import { formatFullDate } from "@/features/calendar/dateUtils";
import type { CalendarEvent } from "@/features/calendar/data";
import type { PersonRecord, PlanPlace, TaskItem, TaskPriority } from "@/types/domain";

type PlanCreateFormProps = {
  defaultDate: string;
  initialEvent?: CalendarEvent;
  initialTask?: TaskItem;
  kind: "event" | "task";
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onDone: () => void;
  onSaveEvent: (event: CalendarEvent) => Promise<void> | void;
  onSaveTask: (task: TaskItem) => Promise<void> | void;
  people: PersonRecord[];
};

export function PlanCreateForm({ defaultDate, initialEvent, initialTask, kind, onClose, onCreatePerson, onDone, onSaveEvent, onSaveTask, people }: PlanCreateFormProps) {
  const initial = kind === "event" ? initialEvent : initialTask;
  const initialEndDate = kind === "event" ? initialEvent?.endDate : initialTask?.dueDate;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(kind === "event" ? initialEvent?.date ?? defaultDate : initialTask?.scheduledDate ?? defaultDate);
  const [endDate, setEndDate] = useState(initialEndDate ?? defaultDate);
  const [hasEndDate, setHasEndDate] = useState(Boolean(initialEndDate));
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority ?? "normal");
  const [startTime, setStartTime] = useState(kind === "event" ? initialEvent?.time ?? "" : initialTask?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [hasTime, setHasTime] = useState(!(initial?.isAllDay ?? true));
  const [hasEndTime, setHasEndTime] = useState(Boolean(initial?.endTime));
  const [place, setPlace] = useState<PlanPlace | undefined>(initial?.place);
  const [companions, setCompanions] = useState<string[]>(initial?.companions?.split(",").map((item) => item.trim()).filter(Boolean) ?? []);
  const [expenseAmount, setExpenseAmount] = useState(initial?.expenseAmount ? String(initial.expenseAmount) : "");
  const [memo, setMemo] = useState(kind === "event" ? initialEvent?.meta ?? "" : initialTask?.memo ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const label = kind === "event" ? "이벤트" : "할 일";
  const endDateLabel = kind === "event" ? "종료일" : "마감일";

  const save = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      if (kind === "event") {
        await onSaveEvent({
          id: initialEvent?.id ?? `calendar-${Date.now()}`,
          date,
          endDate: hasEndDate && endDate !== date ? endDate : undefined,
          type: "event",
          title: title.trim(),
          time: hasTime ? startTime || undefined : undefined,
          endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
          isAllDay: !hasTime,
          meta: memo.trim(),
          expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
          companions: companions.length ? companions.join(", ") : undefined,
          place,
        });
      } else {
        await onSaveTask({
          ...initialTask,
          id: initialTask?.id ?? `task-${Date.now()}`,
          title: title.trim(),
          status: "todo",
          priority,
          scheduledDate: date,
          dueDate: hasEndDate && endDate !== date ? endDate : undefined,
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
      title={`${label} ${initial ? "수정" : "추가"}`}
      submit={<MobileSheetSubmitButton disabled={!title.trim() || isSaving} onClick={save}>{isSaving ? "저장 중..." : initial ? "수정 저장" : `${label} 추가`}</MobileSheetSubmitButton>}
    >
      <FormField label={kind === "event" ? "시작일" : "예정일"}>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate);
            if (endDate < nextDate) setEndDate(nextDate);
          }}
        />
      </FormField>
      <FormField label={endDateLabel}>
        <button
          aria-pressed={hasEndDate}
          className={hasEndDate ? "planner-option-toggle planner-option-toggle--active" : "planner-option-toggle"}
          onClick={() => setHasEndDate((current) => !current)}
          type="button"
        >
          <span>{endDateLabel} 사용</span>
        </button>
        {hasEndDate ? <input min={date} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /> : null}
      </FormField>
        <FormField label="제목"><input autoFocus placeholder={`${label} 제목`} value={title} onChange={(event) => setTitle(event.target.value)} /></FormField>
        {kind === "task" ? (
          <FormField label="우선순위">
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>
          </FormField>
        ) : null}
        <FormField label="시간">
          <div className="record-create-flow__time-toggle-row" role="group" aria-label="시간 설정">
            <button
              aria-pressed={hasTime}
              className={hasTime ? "planner-option-toggle planner-option-toggle--active" : "planner-option-toggle"}
              onClick={() => {
                setHasTime((current) => {
                  const next = !current;
                  if (!next) setHasEndTime(false);
                  return next;
                });
              }}
              type="button"
            >
              <span>시간 사용</span>
            </button>
            <button
              aria-pressed={hasTime && hasEndTime}
              className={hasTime && hasEndTime ? "planner-option-toggle planner-option-toggle--active" : "planner-option-toggle"}
              disabled={!hasTime}
              onClick={() => setHasEndTime((current) => !current)}
              type="button"
            >
              <span>종료 시간 사용</span>
            </button>
          </div>
          {hasTime ? (
            <div className="record-create-flow__time-grid">
              <label className="record-create-flow__time-field">
                <span>시작 시간</span>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>
              {hasEndTime ? (
                <label className="record-create-flow__time-field">
                  <span>종료 시간</span>
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </label>
              ) : null}
            </div>
          ) : null}
        </FormField>
      <FormField label="장소"><PlaceSearchField selectedPlace={place} onSelect={setPlace} /></FormField>
      <FormField label="함께한 사람"><PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} /></FormField>
      <FormField label="지출"><input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} /></FormField>
      <FormField label="메모"><textarea placeholder="간단한 메모" value={memo} onChange={(event) => setMemo(event.target.value)} /></FormField>
    </RecordCreateSheet>
  );
}
