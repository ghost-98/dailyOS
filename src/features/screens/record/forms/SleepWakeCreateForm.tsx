"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { PlaceSearchField } from "@/components/shared/places/PlaceSearchField";
import { formatFullDate } from "@/features/records/time/recordDateTime";
import { RecordCreateSheet } from "@/features/screens/record/components/RecordCreateSheet";
import { confirmAction } from "@/lib/actionGuards";
import type { LifeActivityRecord, PlanPlace } from "@/types/domain";

type SleepWakeCreateFormProps = {
  defaultDate: string;
  mode: "bedtime" | "wake";
  onBack: () => void;
  onDone: () => void;
  onSave: (record: LifeActivityRecord) => Promise<void> | void;
};

export function SleepWakeCreateForm({ defaultDate, mode, onBack, onDone, onSave }: SleepWakeCreateFormProps) {
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(getCurrentTimeValue);
  const [place, setPlace] = useState<PlanPlace>();
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = Boolean(startTime);
  const title = mode === "bedtime" ? "취침" : "기상";

  const save = async () => {
    if (!canSave || isSaving || !confirmAction(`${title} 기록을 추가할까요?`)) return;
    setIsSaving(true);
    try {
      await onSave({
        category: title,
        date,
        id: `${mode}-${Date.now()}`,
        isAllDay: false,
        memo: memo.trim() || undefined,
        placeAddress: place?.address,
        placeName: place?.name,
        startTime,
        title,
      });
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet
      dateLabel={formatFullDate(date)}
      onClose={onBack}
      submit={<MobileSheetSubmitButton disabled={!canSave || isSaving} onClick={save}>{isSaving ? "저장 중..." : `${title} 추가`}</MobileSheetSubmitButton>}
      title={`${title} 추가`}
    >
      <FormField label="날짜"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></FormField>
      <FormField label={`${title} 시간`}><input autoFocus type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></FormField>
      <FormField label="장소"><PlaceSearchField selectedPlace={place} onSelect={setPlace} /></FormField>
      <FormField label="메모"><textarea placeholder={`${title}에 대한 메모`} value={memo} onChange={(event) => setMemo(event.target.value)} /></FormField>
    </RecordCreateSheet>
  );
}

function getCurrentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
