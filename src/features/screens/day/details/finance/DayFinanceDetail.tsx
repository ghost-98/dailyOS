"use client";

import { useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { DayFinanceItem, DayFinanceTotals, DayItemActions } from "@/features/screens/day/dayDetailTypes";

type DayFinanceDetailProps = {
  actions?: DayItemActions;
  finance: DayFinanceTotals;
  items: DayFinanceItem[];
};

export function DayFinanceDetail({ actions, finance, items }: DayFinanceDetailProps) {
  const incomeItems = items.filter((item) => item.external.type === "income");
  const expenseItems = items.filter((item) => item.external.type === "expense");

  return (
    <div className="life-calendar-day-detail life-calendar-day-finance-detail">
      <FinanceGroup actions={actions} label="수입" items={incomeItems} tone="income" total={finance.income} />
      <FinanceGroup label="지출" items={expenseItems} tone="expense" total={finance.expense} />
    </div>
  );
}

function FinanceGroup({ actions, label, items, tone, total }: { actions?: DayItemActions; label: string; items: DayFinanceItem[]; tone: "income" | "expense"; total: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={`life-calendar-day-finance-group life-calendar-day-finance-group--${tone}`}>
      <button aria-expanded={isOpen} className="life-calendar-day-finance-group__toggle" onClick={() => setIsOpen((current) => !current)} type="button">
        <span>{label}</span>
        <strong>{tone === "expense" ? formatExpenseWon(total) : formatSignedWon(total)}</strong>
        <ChevronDown aria-hidden className={isOpen ? "life-calendar-day-finance-group__chevron life-calendar-day-finance-group__chevron--open" : "life-calendar-day-finance-group__chevron"} size={17} />
      </button>
      {isOpen ? (
        <div className="life-calendar-day-finance-group__list">
          {items.length > 0 ? (
            items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.external.title}</strong>
                  <span>{[item.timeLabel, item.external.category, item.external.meta].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="life-calendar-day-finance-group__side">
                  <b>{tone === "expense" ? formatExpenseWon(item.external.amount ?? 0) : formatSignedWon(item.external.amount ?? 0)}</b>
                  {tone === "income" && actions ? <div className="life-calendar-day-item-actions">
                    <button aria-label="수입 수정" onClick={() => void actions.editIncome(item.external.id)} type="button"><Pencil aria-hidden size={13} /></button>
                    <button aria-label="수입 삭제" onClick={() => void actions.deleteIncome(item.external.id)} type="button"><Trash2 aria-hidden size={13} /></button>
                  </div> : null}
                </div>
              </article>
            ))
          ) : (
            <p className="life-calendar-day-finance-group__empty">내역이 없어요.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatSignedWon(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}

function formatExpenseWon(value: number) {
  return value === 0 ? "0원" : `-${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}
