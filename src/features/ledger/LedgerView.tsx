"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { MonthPickerSheet } from "@/features/calendar/CalendarView";
import type { ExpenseCategory, ExpenseRecord } from "@/types/domain";
import { fetchExpenseRecordsFromDb } from "./api";

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

const targetTypeLabels: Record<NonNullable<ExpenseRecord["targetType"]>, string> = {
  activity: "활동",
  event: "이벤트",
  schedule: "일정",
  todo: "할 일",
};

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

type LedgerViewProps = {
  variant?: "page" | "tab";
};

export function LedgerView({ variant = "page" }: LedgerViewProps) {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

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

  return (
    <div className="ledger-page">
      <header className={variant === "tab" ? "life-tab-heading ledger-header" : "page-header ledger-header"}>
        <div>
          <h1>가계부</h1>
          <p className="ledger-header__note">지출은 일정이나 할 일에 입력한 금액에서 자동으로 생성됩니다.</p>
        </div>
      </header>

      {variant === "page" ? <section className="ledger-summary-grid" aria-label="가계부 요약">
        <SectionCard className="ledger-metric ledger-metric--main">
          <span>이번 달 지출</span>
          <strong>{formatCurrency(monthTotal)}</strong>
          <p>{spendingDays > 0 ? `${spendingDays}일 동안 기록됨` : "이번 달 연결 지출이 없습니다."}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>선택한 날짜</span>
          <strong>{formatCurrency(selectedTotal)}</strong>
          <p>{formatFullDate(selectedDate)}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>하루 평균</span>
          <strong>{formatCurrency(dailyAverage)}</strong>
          <p>{topCategory ? `가장 많은 항목: ${categoryLabels[topCategory]}` : "카테고리 없음"}</p>
        </SectionCard>
      </section> : null}

      <div className="ledger-layout">
        <SectionCard className="ledger-calendar-card">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button className="calendar-month-trigger ledger-month-label" onClick={() => setIsMonthPickerOpen(true)} type="button">
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </button>
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
                <p className="eyebrow">연결 지출</p>
                <h2>{formatFullDate(selectedDate)}</h2>
              </div>
            </div>

            <div className="ledger-daily-total">
              <span>합계</span>
              <strong>{formatCurrency(selectedTotal)}</strong>
            </div>

            {variant === "tab" ? (
              <div className="ledger-tab-summary" aria-label="월간 지출 요약">
                <div>
                  <span>이번 달</span>
                  <strong>{formatCurrency(monthTotal)}</strong>
                </div>
                <div>
                  <span>하루 평균</span>
                  <strong>{formatCurrency(dailyAverage)}</strong>
                </div>
                <div>
                  <span>기록일</span>
                  <strong>{spendingDays > 0 ? `${spendingDays}일` : "없음"}</strong>
                </div>
              </div>
            ) : null}

            <div className="ledger-record-list">
              {selectedRecords.length > 0 ? (
                selectedRecords.map((record) => (
                  <article className="ledger-record" key={record.id}>
                    <div>
                      <div className="ledger-record__badges">
                        <Badge tone={categoryTones[record.category]}>{categoryLabels[record.category]}</Badge>
                        <Badge tone="violet">{targetTypeLabels[record.targetType]}</Badge>
                      </div>
                      <strong>{record.title}</strong>
                      {record.memo ? <p>{record.memo}</p> : null}
                    </div>
                    <div className="ledger-record__side">
                      <b>{formatCurrency(record.amount)}</b>
                      <span>원본에서 수정</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="health-empty health-empty--compact">
                  <ReceiptText aria-hidden size={30} />
                  <strong>{isLoading ? "지출을 불러오는 중입니다." : "연결된 지출이 없습니다."}</strong>
                  <p>사건 탭에서 일정이나 할 일에 지출 금액을 입력하면 이곳에 자동으로 표시됩니다.</p>
                </div>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
      {isMonthPickerOpen ? (
        <MonthPickerSheet
          currentMonth={currentMonth}
          onClose={() => setIsMonthPickerOpen(false)}
          onSelect={(nextMonth) => {
            setCurrentMonth(nextMonth);
            setSelectedDate(formatDateKey(nextMonth));
            setIsMonthPickerOpen(false);
          }}
        />
      ) : null}
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
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, key: date });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatCompactCurrency(value: number) {
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}
