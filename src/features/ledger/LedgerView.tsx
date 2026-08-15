"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { MonthPickerSheet } from "@/features/calendar/MonthPickerSheet";
import { useAsyncData } from "@/hooks/useAsyncData";
import { createIncomeRecordInDb, deleteIncomeRecordFromDb, fetchExpenseRecordsFromDb, fetchIncomeRecordsFromDb } from "@/features/ledger/api";
import type { ExpenseCategory, ExpenseRecord, IncomeCategory, IncomeRecord } from "@/types/domain";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();

const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  culture: "문화",
  education: "교육",
  etc: "기타",
  food: "식비",
  health: "건강",
  housing: "주거",
  shopping: "쇼핑",
  transport: "교통",
};

const incomeCategoryLabels: Record<IncomeCategory, string> = {
  business: "사업",
  etc: "기타",
  gift: "선물",
  investment: "투자",
  refund: "환급",
  salary: "급여",
  side: "부수입",
};

const targetTypeLabels: Record<NonNullable<ExpenseRecord["targetType"]>, string> = {
  activity: "활동",
  event: "이벤트",
  schedule: "일정",
  todo: "할 일",
};

type LedgerViewProps = {
  variant?: "page" | "tab";
};

export function LedgerView({ variant = "page" }: LedgerViewProps) {
  const { data, isLoading, setData } = useAsyncData({
    deps: [],
    initialData: { expenses: [] as ExpenseRecord[], incomes: [] as IncomeRecord[] },
    load: async () => {
      const [expenses, incomes] = await Promise.all([fetchExpenseRecordsFromDb(), fetchIncomeRecordsFromDb()]);
      return { expenses: expenses ?? [], incomes: incomes ?? [] };
    },
    onError: (error) => console.error("Failed to load ledger records", error),
  });
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [incomeTitle, setIncomeTitle] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>("salary");
  const [incomeMemo, setIncomeMemo] = useState("");
  const [isSavingIncome, setIsSavingIncome] = useState(false);
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);
  const [isIncomeCaptureExpanded, setIsIncomeCaptureExpanded] = useState(true);

  const { expenses, incomes } = data;

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const monthExpenses = useMemo(() => expenses.filter((record) => record.date.startsWith(monthKey)), [expenses, monthKey]);
  const monthIncomes = useMemo(() => incomes.filter((record) => record.date.startsWith(monthKey)), [incomes, monthKey]);
  const selectedExpenses = useMemo(() => expenses.filter((record) => record.date === selectedDate).sort((a, b) => b.amount - a.amount), [expenses, selectedDate]);
  const selectedIncomes = useMemo(() => incomes.filter((record) => record.date === selectedDate).sort((a, b) => b.amount - a.amount), [incomes, selectedDate]);
  const expensesByDate = useMemo(() => groupRecordsByDate(monthExpenses), [monthExpenses]);
  const incomesByDate = useMemo(() => groupRecordsByDate(monthIncomes), [monthIncomes]);

  const monthExpenseTotal = sumRecords(monthExpenses);
  const monthIncomeTotal = sumRecords(monthIncomes);
  const monthNet = monthIncomeTotal - monthExpenseTotal;
  const selectedExpenseTotal = sumRecords(selectedExpenses);
  const selectedIncomeTotal = sumRecords(selectedIncomes);
  const selectedNet = selectedIncomeTotal - selectedExpenseTotal;
  const activeDays = new Set([...monthExpenses.map((record) => record.date), ...monthIncomes.map((record) => record.date)]).size;
  const dailyNetAverage = activeDays > 0 ? Math.round(monthNet / activeDays) : 0;
  const topExpenseCategory = getTopCategory<ExpenseCategory, ExpenseRecord>(monthExpenses, (category) => expenseCategoryLabels[category]);
  const topIncomeCategory = getTopCategory<IncomeCategory, IncomeRecord>(monthIncomes, (category) => incomeCategoryLabels[category]);

  const moveMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  };

  const createIncome = async () => {
    const trimmedTitle = incomeTitle.trim();
    const amount = Number(incomeAmount);
    if (!trimmedTitle || !Number.isFinite(amount) || amount <= 0 || isSavingIncome) return;

    setIsSavingIncome(true);
    try {
      const saved = await createIncomeRecordInDb({
        amount,
        category: incomeCategory,
        date: selectedDate,
        id: `income-${Date.now()}`,
        memo: incomeMemo.trim() || undefined,
        title: trimmedTitle,
      });
      if (saved) {
        setData((current) => ({ ...current, incomes: [saved, ...current.incomes] }));
        setIncomeTitle("");
        setIncomeAmount("");
        setIncomeMemo("");
        setIncomeCategory("salary");
      }
    } finally {
      setIsSavingIncome(false);
    }
  };

  const removeIncome = async (id: string) => {
    setDeletingIncomeId(id);
    try {
      await deleteIncomeRecordFromDb(id);
      setData((current) => ({ ...current, incomes: current.incomes.filter((record) => record.id !== id) }));
    } finally {
      setDeletingIncomeId(null);
    }
  };

  return (
    <div className="ledger-page">
      <header className={variant === "tab" ? "life-tab-heading ledger-header ui-toolbar-panel" : "page-header ledger-header ui-toolbar-panel"}>
        <div>
          <h1>가계부</h1>
          <p className="ledger-header__note">지출은 일정·할 일·활동과 연결되고, 수입은 이곳에서 직접 기록해 월별 현금 흐름을 함께 봅니다.</p>
        </div>
      </header>

      <section className="ledger-summary-grid" aria-label="가계부 요약">
        <SectionCard className="ledger-metric ledger-metric--main">
          <span>이번 달 순흐름</span>
          <strong>{formatCurrency(monthNet)}</strong>
          <p>{activeDays > 0 ? `${activeDays}일 동안 자금 흐름이 남아 있어요.` : "이번 달에는 아직 자금 흐름이 없어요."}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>이번 달 수입</span>
          <strong>{formatCurrency(monthIncomeTotal)}</strong>
          <p>{topIncomeCategory ? `가장 큰 수입 축 · ${topIncomeCategory}` : "아직 수입 기록 없음"}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>이번 달 지출</span>
          <strong>{formatExpenseCurrency(monthExpenseTotal)}</strong>
          <p>{topExpenseCategory ? `가장 큰 지출 축 · ${topExpenseCategory}` : "아직 지출 기록 없음"}</p>
        </SectionCard>
        <SectionCard className="ledger-metric">
          <span>하루 평균 순흐름</span>
          <strong>{formatCurrency(dailyNetAverage)}</strong>
          <p>{formatFullMonth(currentMonth)}</p>
        </SectionCard>
      </section>

      <div className="ledger-layout ui-workspace-grid ui-workspace-grid--sidebar">
        <SectionCard className="ledger-calendar-card ui-workspace-panel ui-workspace-panel--tall">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button className="calendar-month-trigger" onClick={() => setIsMonthPickerOpen(true)} type="button">
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
              const dayExpenses = cell.date ? expensesByDate.get(cell.date) ?? [] : [];
              const dayIncomes = cell.date ? incomesByDate.get(cell.date) ?? [] : [];
              const expenseTotal = sumRecords(dayExpenses);
              const incomeTotal = sumRecords(dayIncomes);
              const net = incomeTotal - expenseTotal;
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
                  <div className="ledger-day__stack">
                    {incomeTotal > 0 ? <span className="ledger-day__income">+{formatCompactCurrency(incomeTotal)}</span> : <span className="ledger-day__empty" />}
                    {expenseTotal > 0 ? <span className="ledger-day__expense">-{formatCompactCurrency(expenseTotal)}</span> : <span className="ledger-day__empty" />}
                  </div>
                  {(dayExpenses.length > 0 || dayIncomes.length > 0) ? <em>{net >= 0 ? "흑자" : "지출 우세"}</em> : null}
                </button>
              );
            })}
          </div>
        </SectionCard>

        <aside className="ledger-detail">
          <SectionCard className="date-detail-card ui-workspace-panel ui-workspace-panel--tall">
            <div className="section-heading ledger-detail-heading ui-panel-heading">
              <div className="ui-panel-heading__intro">
                <p className="eyebrow">선택 날짜 자금 흐름</p>
                <h2>{formatFullDate(selectedDate)}</h2>
              </div>
            </div>

            <div className="ledger-tab-summary" aria-label="하루 요약">
              <div>
                <span>수입</span>
                <strong>{formatCurrency(selectedIncomeTotal)}</strong>
              </div>
              <div>
                <span>지출</span>
                <strong>{formatExpenseCurrency(selectedExpenseTotal)}</strong>
              </div>
              <div>
                <span>순흐름</span>
                <strong>{formatCurrency(selectedNet)}</strong>
              </div>
            </div>

            <div className={`ledger-capture-panel${isIncomeCaptureExpanded ? "" : " ledger-capture-panel--collapsed"}`}>
              <div className="section-heading ledger-capture-panel__heading ui-panel-heading">
                <div className="ui-panel-heading__intro">
                  <p className="eyebrow">Income Capture</p>
                  <h3>수입 추가</h3>
                </div>
                <IconButton
                  label={isIncomeCaptureExpanded ? "수입 입력 접기" : "수입 입력 열기"}
                  onClick={() => setIsIncomeCaptureExpanded((current) => !current)}
                  size="sm"
                  tone="ghost"
                >
                  {isIncomeCaptureExpanded ? <X aria-hidden size={17} /> : <Plus aria-hidden size={17} />}
                </IconButton>
              </div>

              {isIncomeCaptureExpanded ? (
              <div className="ledger-income-form">
                <label>
                  <span>제목</span>
                  <input placeholder="예: 월급, 환급, 사이드 프로젝트" value={incomeTitle} onChange={(event) => setIncomeTitle(event.target.value)} />
                </label>
                <label>
                  <span>금액</span>
                  <input inputMode="numeric" placeholder="0" value={incomeAmount} onChange={(event) => setIncomeAmount(event.target.value.replace(/[^\d]/g, ""))} />
                </label>
                <label>
                  <span>카테고리</span>
                  <select value={incomeCategory} onChange={(event) => setIncomeCategory(event.target.value as IncomeCategory)}>
                    {Object.entries(incomeCategoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>메모</span>
                  <textarea placeholder="입금 경로나 설명" rows={3} value={incomeMemo} onChange={(event) => setIncomeMemo(event.target.value)} />
                </label>
                <ActionButton disabled={isSavingIncome || !incomeTitle.trim() || !incomeAmount} onClick={() => void createIncome()}>
                  {isSavingIncome ? "저장 중..." : "수입 저장"}
                </ActionButton>
              </div>
              ) : null}
            </div>

            <div className="ledger-record-list">
              {selectedIncomes.length > 0 ? (
                selectedIncomes.map((record) => (
                  <article className="ledger-record ledger-record--income" key={record.id}>
                    <div>
                      <div className="ledger-record__badges">
                        <Badge tone="green">{incomeCategoryLabels[record.category]}</Badge>
                        <Badge tone="amber">수입</Badge>
                      </div>
                      <strong>{record.title}</strong>
                      {record.memo ? <p>{record.memo}</p> : null}
                    </div>
                    <div className="ledger-record__side">
                      <b>{formatIncomeCurrency(record.amount)}</b>
                      <div>
                        <button aria-label="수입 삭제" disabled={deletingIncomeId === record.id} onClick={() => void removeIncome(record.id)} type="button">
                          <Trash2 aria-hidden size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : null}

              {selectedExpenses.length > 0 ? (
                selectedExpenses.map((record) => (
                  <article className="ledger-record" key={record.id}>
                    <div>
                      <div className="ledger-record__badges">
                        <Badge tone="violet">{expenseCategoryLabels[record.category]}</Badge>
                        <Badge tone="pink">{targetTypeLabels[record.targetType]}</Badge>
                      </div>
                      <strong>{record.title}</strong>
                      {record.memo ? <p>{record.memo}</p> : null}
                    </div>
                    <div className="ledger-record__side">
                      <b>{formatExpenseCurrency(record.amount)}</b>
                      <span>원본 기록에서 수정</span>
                    </div>
                  </article>
                ))
              ) : null}

              {selectedIncomes.length === 0 && selectedExpenses.length === 0 ? (
                <div className="health-empty health-empty--compact">
                  <ReceiptText aria-hidden size={30} />
                  <strong>{isLoading ? "가계부를 불러오는 중입니다." : "이 날짜에는 자금 흐름이 없어요."}</strong>
                  <p>지출은 일정·할 일·활동에서 연결되고, 수입은 여기서 직접 남길 수 있습니다.</p>
                </div>
              ) : null}
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

function groupRecordsByDate<T extends { amount: number; date: string }>(records: T[]) {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    grouped.set(record.date, [...(grouped.get(record.date) ?? []), record]);
  }
  return grouped;
}

function sumRecords<T extends { amount: number }>(records: T[]) {
  return records.reduce((total, record) => total + record.amount, 0);
}

function getTopCategory<TCategory extends string, TRecord extends { amount: number; category: TCategory }>(records: TRecord[], labelOf: (category: TCategory) => string) {
  const totals = new Map<TCategory, number>();
  for (const record of records) {
    totals.set(record.category, (totals.get(record.category) ?? 0) + record.amount);
  }
  const top = [...totals.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  return top ? labelOf(top) : null;
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

function formatFullMonth(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatCurrency(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}

function formatIncomeCurrency(value: number) {
  return `+${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}

function formatExpenseCurrency(value: number) {
  return `-${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}

function formatCompactCurrency(value: number) {
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}
