export function getMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null; key: string }> = [];
  for (let index = 0; index < firstDay.getDay(); index += 1) cells.push({ date: null, day: null, key: `empty-start-${index}` });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, key: date });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, key: `empty-end-${cells.length}` });
  return cells;
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric", month: "long", weekday: "long" }).format(new Date(`${value}T00:00:00`));
}

export function isDateInRange(date: string, startDate: string, endDate?: string) {
  return startDate <= date && date <= (endDate || startDate);
}

export function parseOptionalAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

export function formatMinutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(restMinutes).padStart(2, "0")}`;
}

export function getRoundedCurrentTime() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  return formatMinutesLabel(now.getHours() * 60 + now.getMinutes());
}
