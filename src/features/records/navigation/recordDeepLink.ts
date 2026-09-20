export type RecordFocusType = "activity" | "daily_log" | "event" | "expense" | "income" | "photo" | "todo" | "weight" | "workout";

const focusPrefixes: Record<RecordFocusType, string> = {
  activity: "activity",
  daily_log: "daily-log",
  event: "event",
  expense: "expense",
  income: "income",
  photo: "photo",
  todo: "todo",
  weight: "weight",
  workout: "workout",
};

export function createRecordFocusId(type: RecordFocusType, id: string) {
  return `${focusPrefixes[type]}-${id}`;
}

export function createDayRecordHref(date: string, focusId: string) {
  const params = new URLSearchParams({ date, focus: focusId });
  return `/m/day?${params.toString()}`;
}
