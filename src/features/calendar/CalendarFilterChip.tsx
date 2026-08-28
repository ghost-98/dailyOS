"use client";

type CalendarFilterChipTone = "event" | "record" | "todo";

type CalendarFilterChipProps = {
  active?: boolean;
  compact?: boolean;
  count?: number;
  label?: string;
  muted?: boolean;
  onClick?: () => void;
  tone: CalendarFilterChipTone;
};

export function CalendarFilterChip({
  active = false,
  compact = false,
  count,
  label,
  muted = false,
  onClick,
  tone,
}: CalendarFilterChipProps) {
  const className = [
    "calendar-filter",
    `calendar-filter--${tone}`,
    active ? "calendar-filter--active" : "",
    muted ? "calendar-filter--muted" : "",
    compact ? "calendar-filter--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className={`calendar-dot calendar-dot--${tone}`} />
      {!compact && label ? <span>{label}</span> : null}
      {typeof count === "number" ? <b>{count}</b> : null}
    </>
  );

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
