"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

export type UnifiedTimelineDetailRow = {
  icon: LucideIcon;
  value: string;
};

export function UnifiedTimelineCard({
  actions,
  badge,
  details = [],
  expanded,
  isDone = false,
  leading,
  title,
  tone,
  onToggle,
}: {
  actions?: ReactNode;
  badge: ReactNode;
  details?: UnifiedTimelineDetailRow[];
  expanded: boolean;
  isDone?: boolean;
  leading: ReactNode;
  title: string;
  tone: "activity" | "event" | "todo";
  onToggle: () => void;
}) {
  return (
    <article
      className={[
        "record-timeline-card",
        `record-timeline-card--${tone}`,
        "record-timeline-card--mobile",
        expanded ? "record-timeline-card--expanded" : "",
        isDone ? "record-timeline-card--done" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tone === "todo" ? (
        <div
          aria-expanded={expanded}
          className="record-timeline-card__summary"
          onClick={onToggle}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="record-timeline-card__leading">{leading}</div>
          <div className="record-timeline-card__body">
            <div className="record-timeline-card__meta-row">{badge}</div>
            <strong>{title}</strong>
          </div>
          <div className="record-timeline-card__chevron">
            <ChevronDown aria-hidden size={18} />
          </div>
        </div>
      ) : (
        <button aria-expanded={expanded} className="record-timeline-card__summary" onClick={onToggle} type="button">
          <div className="record-timeline-card__leading">{leading}</div>
          <div className="record-timeline-card__body">
            <div className="record-timeline-card__meta-row">{badge}</div>
            <strong>{title}</strong>
          </div>
          <div className="record-timeline-card__chevron">
            <ChevronDown aria-hidden size={18} />
          </div>
        </button>
      )}

      <div className={expanded ? "record-timeline-card__detail record-timeline-card__detail--open" : "record-timeline-card__detail"}>
        <div className="record-timeline-card__detail-inner">
          {details.length > 0 ? (
            <div className="record-timeline-card__detail-grid">
              {details.map((item, index) => (
                <div className="record-timeline-card__detail-row" key={`${item.value}-${index}`}>
                  <item.icon aria-hidden size={14} />
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          {actions ? <div className="record-timeline-card__actions">{actions}</div> : null}
        </div>
      </div>
    </article>
  );
}

