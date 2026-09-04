"use client";

import { Check, RotateCcw, X } from "lucide-react";

type PeriodFilterSheetProps = {
  endDate: string;
  isOpen: boolean;
  onClose: () => void;
  onEndDateChange: (value: string) => void;
  onReset: () => void;
  onStartDateChange: (value: string) => void;
  startDate: string;
};

export function PeriodFilterSheet({ endDate, isOpen, onClose, onEndDateChange, onReset, onStartDateChange, startDate }: PeriodFilterSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="life-search-period-sheet__backdrop" onClick={onClose} role="presentation">
      <section className="life-search-period-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="life-search-period-sheet__head">
          <div className="life-search-period-sheet__title"><p className="eyebrow">기간 설정</p></div>
          <button aria-label="기간 설정 닫기" className="life-search-period-sheet__icon-button" onClick={onClose} type="button"><X aria-hidden size={16} /></button>
        </div>
        <div className="life-search-period-sheet__inputs">
          <label><span>시작일</span><input aria-label="시작일" type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} /></label>
          <label><span>종료일</span><input aria-label="종료일" type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} /></label>
        </div>
        <div className="life-search-period-sheet__actions">
          <button aria-label="기간 초기화" className="life-search-period-sheet__icon-button" onClick={onReset} type="button"><RotateCcw aria-hidden size={15} /></button>
          <button className="life-search-period-sheet__done life-search-period-sheet__done--small" onClick={onClose} type="button"><Check aria-hidden size={15} /><span>적용</span></button>
        </div>
      </section>
    </div>
  );
}
