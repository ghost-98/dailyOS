import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";

export function RecordCreateSheet({ children, dateLabel, onClose, submit, title }: { children: ReactNode; dateLabel: string; onClose: () => void; submit: ReactNode; title: string }) {
  return (
    <SectionCard className="record-create-flow__sheet">
      <header className="record-create-flow__sheet-header">
        <div className="record-create-flow__sheet-header-row">
          <p className="eyebrow">{title}</p>
          <IconButton label="닫기" onClick={onClose} size="sm" tone="outline"><X aria-hidden size={16} /></IconButton>
        </div>
        <div className="record-create-flow__sheet-date-row">
          <span className="record-create-flow__sheet-date">{dateLabel}</span>
        </div>
      </header>
      <div className="record-create-flow__form">{children}</div>
      {submit}
    </SectionCard>
  );
}
