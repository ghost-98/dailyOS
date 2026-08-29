"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

type MobileRecordSheetProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  title: string;
};

export function MobileRecordSheet({ children, className = "", description, onClose, title }: MobileRecordSheetProps) {
  const titleId = `${title.replace(/\s+/g, "-").toLowerCase()}-sheet-title`;

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`event-sheet planner-sheet ${className}`.trim()}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header planner-sheet__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton label="닫기" onClick={onClose} tone="outline">
            <X aria-hidden size={18} />
          </IconButton>
        </header>
        <div className="event-sheet__body planner-sheet__body">{children}</div>
      </section>
    </div>
  );
}
