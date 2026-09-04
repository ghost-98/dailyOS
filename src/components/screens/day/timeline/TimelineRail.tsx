"use client";

import { Children, type ReactNode } from "react";

type TimelineRailProps = {
  children: ReactNode;
  className?: string;
  empty?: ReactNode;
  headline?: string;
  meta?: ReactNode;
};

export function TimelineRail({ children, className = "", empty, headline, meta }: TimelineRailProps) {
  const renderedItems = Children.toArray(children);

  return (
    <section className={`timeline-rail ${className}`.trim()}>
      {headline || meta ? (
        <div className="timeline-rail__head">
          <div className="timeline-rail__head-copy">
            {headline ? <span>{headline}</span> : null}
          </div>
          {meta ? <strong className="timeline-rail__meta">{meta}</strong> : null}
        </div>
      ) : null}

      {renderedItems.length > 0 ? (
        <div className="timeline-rail__track">
          {renderedItems.map((item, index) => (
            <div className="timeline-rail__item" key={index}>
              {item}
            </div>
          ))}
        </div>
      ) : (
        empty ?? null
      )}
    </section>
  );
}
