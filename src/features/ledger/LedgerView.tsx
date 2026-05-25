"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { ExpenseCategory, ExpenseRecord } from "@/types/domain";
import { createExpenseRecordInDb, deleteExpenseRecordFromDb, fetchExpenseRecordsFromDb, updateExpenseRecordInDb } from "./api";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();

const categoryLabels: Record<ExpenseCategory, string> = {
  food: "식비",
  transport: "교통",
  shopping: "쇼핑",
  housing: "주거",
  health: "건강",
  culture: "문화",
  education: "교육",
  etc: "기타",
};

const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ label, value: value as ExpenseCategory }));

const categoryTones: Record<ExpenseCategory, "violet" | "green" | "pink" | "amber" | "muted"> = {
  food: "amber",
  transport: "violet",
  shopping: "pink",
  housing: "violet",
  health: "green",
  culture: "pink",
  education: "green",
  etc: "muted",
};

export function LedgerView() {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetchExpenseRecordsFromDb()
      .then((dbRecords) => {
        if (isMounted) setRecords(dbRecords ?? []);
      })
      .catch((error) => console.error("Failed to load expense records from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const monthRecords = useMemo(() => records.filter((record) => record.date.startsWith(monthKey)), [monthKey, records]);
  const selectedRecords = useMemo(
    () => records.filter((record) => record.date === selectedDate).sort((a, b) => b.amount - a.amount),
    [records, selectedDate],
  );
  const recordsByDate = useMemo(() => groupRecordsByDate(monthRecords), [monthRecords]);
  const monthTotal = sumRecords(monthRecords);
  const selectedTotal = sumRecords(selectedRecords);
  const spendingDays = new Set(monthRecords.map((record) => record.date)).size;
  const dailyAverage = spendingDays > 0 ? Math.round(monthTotal / spendingDays) : 0;
  const topCategory = getTopCategory(monthRecords);

  const moveMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  };

  const openCreateSheet = (date = selectedDate) => {
    setEditingRecord({
      id: `expense-${Date.now()}`,
      date,
      title: "",
      amount: 0,
      category: "food",
      memo: "",
    });
    setIsSheetOpen(true);
  };

  const saveRecord = async (record: ExpenseRecord) => {
    const exists = records.some((item) => item.id === record.id);
    const savedRecord = exists ? await updateExpenseRecordInDb(record) : await createExpenseRecordInDb(record);
    const nextRecord = savedRecord ?? record;

    setRecords((current) => (exists ? current.map((item) => (item.id === record.id ? nextRecord : item)) : [nextRecord, ...current]));
    setCurrentMonth(new Date(`${nextRecord.date}T00:00:00`));
    setSelectedDate(nextRecord.date);
    setIsSheetOpen(false);
    setEditingRecord(null);
  };

  const deleteRecord = async (id: string) => {
    await deleteExpenseRecordFromDb(id);
    setRecords((current) => current.filter((record) => record.id !== id));
  };

  return (
    <div className="ledger-page">
      <header className="page-header ledger-header">
        <div>
          <h1>가계부</h1>
        </div>
        <button className="header-action" onClick={() => openCreateSheet()} type="button">
          <Plus aria-hidden size={18} />
          지출 추가
        </button>
      </header>

      <section className="ledger-summary-grid" aria-label="가계부 요약">
        <SectionCard className="ledger-metric ledger-metric--main">
          <span>이번 달 지출</span>
          <strong>{formatCurrency(monthTotal)}</strong>
          <p>{spendingDays > 0 ? `${spendingDays}일 동안 기록됨` : "이번 달 기록이 없습니다."}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>선택한 날짜</span>
          <strong>{formatCurrency(selectedTotal)}</strong>
          <p>{formatFullDate(selectedDate)}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>하루 평균</span>
          <strong>{formatCurrency(dailyAverage)}</strong>
          <p>{topCategory ? `가장 큰 항목: ${categoryLabels[topCategory]}` : "카테고리 없음"}</p>
        </SectionCard>
      </section>

      <div className="ledger-layout">
        <SectionCard className="ledger-calendar-card">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <div className="calendar-month-trigger ledger-month-label">
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </div>
            <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">
              <ChevronRight aria-hidden size={20} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid ledger-calendar-grid">
            {monthDays.map((cell) => {
              const dayRecords = cell.date ? recordsByDate.get(cell.date) ?? [] : [];
              const dayTotal = sumRecords(dayRecords);
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === formatDateKey(new Date());

              return (
                <button
                  className={`calendar-day ledger-day ${isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? setSelectedDate(cell.date) : undefined)}
                  type="button"
                >
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
                  {dayTotal > 0 ? <span className="ledger-day__amount">{formatCompactCurrency(dayTotal)}</span> : <span className="ledger-day__empty" />}
                  {dayRecords.length > 0 ? <em>{dayRecords.length}건</em> : null}
                </button>
              );
            })}
          </div>
        </SectionCard>

        <aside className="ledger-detail">
          <SectionCard className="date-detail-card">
            <div className="section-heading ledger-detail-heading">
              <div>
                <p className="eyebrow">일간 지출</p>
                <h2>{formatFullDate(selectedDate)}</h2>
              </div>
              <button className="event-sheet__icon-button" aria-label="선택 날짜 지출 추가" onClick={() => openCreateSheet(selectedDate)} type="button">
                <Plus aria-hidden size={17} />
              </button>
            </div>

            <div className="ledger-daily-total">
              <span>합계</span>
              <strong>{formatCurrency(selectedTotal)}</strong>
            </div>

            <div className="ledger-record-list">
              {selectedRecords.length > 0 ? (
                selectedRecords.map((record) => (
                  <article className="ledger-record" key={record.id}>
                    <div>
                      <Badge tone={categoryTones[record.category]}>{categoryLabels[record.category]}</Badge>
                      <strong>{record.title}</strong>
                      {record.memo ? <p>{record.memo}</p> : null}
                    </div>
                    <div className="ledger-record__side">
                      <b>{formatCurrency(record.amount)}</b>
                      <div>
                        <button
                          aria-label="지출 수정"
                          onClick={() => {
                            setEditingRecord(record);
                            setIsSheetOpen(true);
                          }}
                          type="button"
                        >
                          <Pencil aria-hidden size={14} />
                        </button>
                        <button aria-label="지출 삭제" onClick={() => void deleteRecord(record.id)} type="button">
                          <Trash2 aria-hidden size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="health-empty health-empty--compact">
                  <ReceiptText aria-hidden size={30} />
                  <strong>{isLoading ? "지출을 불러오는 중입니다." : "기록된 지출이 없습니다."}</strong>
                  <p>오늘 쓴 돈을 하나씩 남기면 월간 흐름을 캘린더에서 볼 수 있습니다.</p>
                  <button className="event-sheet__primary-button" onClick={() => openCreateSheet(selectedDate)} type="button">
                    지출 추가
                  </button>
                </div>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>

      {isSheetOpen && editingRecord ? (
        <ExpenseSheet
          record={editingRecord}
          onClose={() => {
            setEditingRecord(null);
            setIsSheetOpen(false);
          }}
          onSave={saveRecord}
        />
      ) : null}
    </div>
  );
}

function ExpenseSheet({
  onClose,
  onSave,
  record,
}: {
  onClose: () => void;
  onSave: (record: ExpenseRecord) => Promise<void> | void;
  record: ExpenseRecord;
}) {
  const [form, setForm] = useState(record);
  const canSave = form.title.trim().length > 0 && form.amount > 0 && Boolean(form.date);

  const updateField = <Key extends keyof ExpenseRecord>(key: Key, value: ExpenseRecord[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="expense-sheet-title" aria-modal="true" className="event-sheet ledger-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <div>
            <h2 id="expense-sheet-title">지출 기록</h2>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="event-sheet__body ledger-sheet__body">
          <label className="event-form-row event-form-row--field">
            <span>날짜</span>
            <input type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} />
          </label>
          <label className="event-form-row event-form-row--field">
            <span>항목</span>
            <input placeholder="점심, 커피, 지하철" value={form.title} onChange={(event) => updateField("title", event.target.value)} />
          </label>
          <label className="event-form-row event-form-row--field">
            <span>금액</span>
            <input min={0} inputMode="numeric" type="number" value={form.amount || ""} onChange={(event) => updateField("amount", Number(event.target.value))} />
          </label>
          <label className="event-form-row event-form-row--select">
            <span>카테고리</span>
            <select value={form.category} onChange={(event) => updateField("category", event.target.value as ExpenseCategory)}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="event-form-row event-form-row--field">
            <span>메모</span>
            <textarea rows={3} placeholder="필요하면 짧게 기록" value={form.memo ?? ""} onChange={(event) => updateField("memo", event.target.value)} />
          </label>
        </div>

        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" disabled={!canSave} onClick={() => void onSave({ ...form, title: form.title.trim() })} type="button">
            저장
          </button>
        </footer>
      </section>
    </div>
  );
}

function groupRecordsByDate(records: ExpenseRecord[]) {
  const grouped = new Map<string, ExpenseRecord[]>();
  for (const record of records) {
    grouped.set(record.date, [...(grouped.get(record.date) ?? []), record]);
  }
  return grouped;
}

function sumRecords(records: ExpenseRecord[]) {
  return records.reduce((total, record) => total + record.amount, 0);
}

function getTopCategory(records: ExpenseRecord[]) {
  const totals = new Map<ExpenseCategory, number>();
  for (const record of records) {
    totals.set(record.category, (totals.get(record.category) ?? 0) + record.amount);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: Array<{ date: string | null; day: number | null; key: string }> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push({ date: null, day: null, key: `empty-start-${index}` });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date: formatDateKey(date), day, key: formatDateKey(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFullDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    currency: "KRW",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}만`;
  return new Intl.NumberFormat("ko-KR").format(value);
}
