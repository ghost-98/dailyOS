"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { formatFullDate } from "@/features/calendar/dateUtils";
import { RecordCreateSheet } from "@/features/screens/record/components/RecordCreateSheet";
import { confirmAction } from "@/lib/actionGuards";
import type { IncomeCategory, IncomeRecord } from "@/types/domain";

const INCOME_CATEGORIES: Array<{ label: string; value: IncomeCategory }> = [
  { label: "급여", value: "salary" },
  { label: "사업", value: "business" },
  { label: "투자", value: "investment" },
  { label: "용돈", value: "gift" },
  { label: "환급", value: "refund" },
  { label: "부수입", value: "side" },
  { label: "기타", value: "etc" },
];

type IncomeCreateFormProps = {
  defaultDate: string;
  initialRecord?: IncomeRecord;
  onBack: () => void;
  onDone: () => void;
  onSave: (record: IncomeRecord) => Promise<void> | void;
};

export function IncomeCreateForm({ defaultDate, initialRecord, onBack, onDone, onSave }: IncomeCreateFormProps) {
  const [date, setDate] = useState(initialRecord?.date ?? defaultDate);
  const [title, setTitle] = useState(initialRecord?.title ?? "");
  const [amount, setAmount] = useState(initialRecord ? String(initialRecord.amount) : "");
  const [category, setCategory] = useState<IncomeCategory>(initialRecord?.category ?? "salary");
  const [memo, setMemo] = useState(initialRecord?.memo ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = Boolean(title.trim() && Number(amount) > 0);

  const save = async () => {
    if (!canSave || isSaving || !confirmAction(initialRecord ? "수입 수정을 저장할까요?" : "수입을 추가할까요?")) return;
    setIsSaving(true);
    try {
      await onSave({
        amount: Number(amount),
        category,
        date,
        id: initialRecord?.id ?? `income-${Date.now()}`,
        memo: memo.trim() || undefined,
        title: title.trim(),
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
      submit={<MobileSheetSubmitButton disabled={!canSave || isSaving} onClick={save}>{isSaving ? "저장 중..." : initialRecord ? "수정 저장" : "수입 추가"}</MobileSheetSubmitButton>}
      title={initialRecord ? "수입 수정" : "수입 추가"}
    >
      <FormField label="날짜"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></FormField>
      <FormField label="항목"><input autoFocus placeholder="예: 월급, 환급금" value={title} onChange={(event) => setTitle(event.target.value)} /></FormField>
      <FormField label="금액"><input inputMode="numeric" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))} /></FormField>
      <FormField label="분류">
        <div className="record-create-flow__category-grid" role="list" aria-label="수입 분류">
          {INCOME_CATEGORIES.map((item) => (
            <span className={category === item.value ? "record-create-flow__category-item record-create-flow__category-item--active" : "record-create-flow__category-item"} key={item.value}>
              <button aria-pressed={category === item.value} onClick={() => setCategory(item.value)} type="button">{item.label}</button>
            </span>
          ))}
        </div>
      </FormField>
      <FormField label="메모"><textarea placeholder="수입에 대한 메모" value={memo} onChange={(event) => setMemo(event.target.value)} /></FormField>
    </RecordCreateSheet>
  );
}
