"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PeriodFilterSheet } from "@/components/shared/date/PeriodFilterSheet";
import { PeriodSummaryBar } from "@/components/shared/date/PeriodSummaryBar";
import { OtherTabShell } from "@/features/screens/other/components/OtherTabShell";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";

export function LedgerView() {
  const { data } = useRecordsDataState();
  const initialPeriod = useMemo(() => getCurrentMonthPeriod(), []);
  const [startDate, setStartDate] = useState(initialPeriod.startDate);
  const [endDate, setEndDate] = useState(initialPeriod.endDate);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [activeBreakdown, setActiveBreakdown] = useState<"income" | "expense" | null>(null);
  const ledger = useMemo(() => {
    const entries = [
      ...data.incomes.map((item) => ({ amount: item.amount, date: item.date, id: `income-${item.id}`, title: item.title, type: "income" as const })),
      ...data.expenses.map((item) => ({ amount: item.amount, date: item.date, id: `expense-${item.id}`, title: item.title, type: "expense" as const })),
    ].filter((item) => (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate)).sort((left, right) => right.date.localeCompare(left.date));
    const income = entries.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = entries.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { entries, expense, income };
  }, [data.expenses, data.incomes, endDate, startDate]);

  return (
    <OtherTabShell title="가계부">
      <PeriodSummaryBar count={ledger.entries.length} countUnit="건" endDate={endDate} onOpenPeriod={() => setIsPeriodOpen(true)} startDate={startDate} />
      <section className="other-ledger-summary">
        <div className="other-ledger-totals">
          <button aria-pressed={activeBreakdown === "income"} onClick={() => setActiveBreakdown((current) => current === "income" ? null : "income")} type="button"><span><ArrowDownLeft aria-hidden size={14} /> 수입</span><strong>{formatWon(ledger.income)}</strong></button>
          <button aria-pressed={activeBreakdown === "expense"} onClick={() => setActiveBreakdown((current) => current === "expense" ? null : "expense")} type="button"><span><ArrowUpRight aria-hidden size={14} /> 지출</span><strong>{formatWon(ledger.expense)}</strong></button>
        </div>
        {activeBreakdown ? (
          <div className="other-ledger-breakdown">
            {ledger.entries.filter((entry) => entry.type === activeBreakdown).map((entry) => (
              <article key={`breakdown-${entry.id}`}><div><strong>{entry.title}</strong><span>{entry.date}</span></div><b>{formatWon(entry.amount)}</b></article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="other-ledger-history">
        <div className="other-ledger-history__head"><span>최근 내역</span><strong>{ledger.entries.length}건</strong></div>
        <div className="other-ledger-history__list">
          {ledger.entries.length > 0 ? ledger.entries.map((entry) => (
            <article key={entry.id}>
              <span className={`other-ledger-entry__icon other-ledger-entry__icon--${entry.type}`}>
                {entry.type === "income" ? <ArrowDownLeft aria-hidden size={15} /> : <ArrowUpRight aria-hidden size={15} />}
              </span>
              <div><strong>{entry.title}</strong><span>{entry.date}</span></div>
              <b className={`other-ledger-entry__amount other-ledger-entry__amount--${entry.type}`}>{entry.type === "income" ? "+" : "-"}{formatWon(entry.amount)}</b>
            </article>
          )) : <div className="life-empty-state">아직 수입·지출 내역이 없어요.</div>}
        </div>
      </section>
      <PeriodFilterSheet
        endDate={endDate}
        isOpen={isPeriodOpen}
        onClose={() => setIsPeriodOpen(false)}
        onEndDateChange={setEndDate}
        onReset={() => { const period = getCurrentMonthPeriod(); setStartDate(period.startDate); setEndDate(period.endDate); }}
        onStartDateChange={setStartDate}
        startDate={startDate}
      />
    </OtherTabShell>
  );
}

function getCurrentMonthPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return { startDate: formatDateInput(new Date(year, month, 1)), endDate: formatDateInput(new Date(year, month + 1, 0)) };
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWon(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}
