export function DailyOSMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect className="dailyos-mark__surface" x="2.5" y="2.5" width="35" height="35" rx="11" />
      <path className="dailyos-mark__arc" d="M11.5 21.4c0-6 4.4-10.9 10.6-10.9 4 0 7.3 2 9.1 5.1" />
      <path className="dailyos-mark__arc dailyos-mark__arc--soft" d="M28.7 18.3c.3 1 .4 2 .4 3.1 0 6-4.4 10.9-10.6 10.9-3.2 0-6-1.3-7.9-3.5" />
      <path className="dailyos-mark__check" d="m13 22.3 3.3 3.5 7.4-8" />
      <path className="dailyos-mark__grid" d="M12.4 12.7h5.2M12.4 16.9h5.2M22.5 27.3h5.2" />
      <circle className="dailyos-mark__point" cx="29.5" cy="15.8" r="2.4" />
    </svg>
  );
}
