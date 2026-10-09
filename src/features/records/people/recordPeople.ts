import type { CalendarEvent } from "@/features/calendar/data";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifePhotoRecord, TaskItem } from "@/types/domain";
import type { RecordSearchItem } from "@/features/records/search/recordSearchItems";
import { formatActivityTime, formatRecordContextMeta } from "@/features/records/format/recordFormatters";
import { createRecordFocusId } from "@/features/records/navigation/recordDeepLink";
type PersonSummary = {
  expenseTotal: number;
  expenses: ExpenseRecord[];
  items: RecordSearchItem[];
  logs: DailyLogRecord[];
  name: string;
  photos: LifePhotoRecord[];
  places: string[];
};

export function parseCompanions(value?: string) {
  return (value ?? "")
    .split(/[,，、·]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildRecordPeopleSummaries(events: CalendarEvent[], tasks: TaskItem[], activities: LifeActivityRecord[], expenses: ExpenseRecord[], logs: DailyLogRecord[], photos: LifePhotoRecord[]) {
  const people = new Map<string, PersonSummary>();

  const ensurePerson = (name: string) => {
    const current = people.get(name);
    if (current) return current;
    const nextPerson: PersonSummary = { expenseTotal: 0, expenses: [], items: [], logs: [], name, photos: [], places: [] };
    people.set(name, nextPerson);
    return nextPerson;
  };

  for (const event of events.filter((item) => item.type === "event")) {
    const targetType = "event";
    for (const name of parseCompanions(event.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === targetType && expense.targetId === event.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === targetType && log.linkedTargetId === event.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === targetType && photo.linkedTargetId === event.id);
      person.items.push({
        date: event.date,
        description: formatRecordContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        id: `${name}-${targetType}-${event.id}`,
        focusId: createRecordFocusId(targetType, event.id),
        label: "이벤트",
        tags: [event.place?.name, event.meta].filter(Boolean) as string[],
        title: event.title,
        type: targetType,
      });
      person.expenses.push(...linkedExpenses);
      person.logs.push(...linkedLogs);
      person.photos.push(...linkedPhotos);
      if (event.place?.name) person.places.push(event.place.name);
    }
  }

  for (const task of tasks) {
    for (const name of parseCompanions(task.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === "todo" && expense.targetId === task.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === "todo" && log.linkedTargetId === task.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === "todo" && photo.linkedTargetId === task.id);
      person.items.push({
        date: task.scheduledDate,
        description: formatRecordContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
        id: `${name}-todo-${task.id}`,
        focusId: createRecordFocusId("todo", task.id),
        label: "할일",
        tags: [task.place?.name, task.memo].filter(Boolean) as string[],
        title: task.title,
        type: "todo",
      });
      person.expenses.push(...linkedExpenses);
      person.logs.push(...linkedLogs);
      person.photos.push(...linkedPhotos);
      if (task.place?.name) person.places.push(task.place.name);
    }
  }

  for (const activity of activities) {
    for (const name of parseCompanions(activity.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === "activity" && expense.targetId === activity.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === "activity" && log.linkedTargetId === activity.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === "activity" && photo.linkedTargetId === activity.id);
      person.items.push({
        date: activity.date,
        description: [formatActivityTime(activity), activity.placeName, activity.food, activity.memo].filter(Boolean).join(" · "),
        id: `${name}-activity-${activity.id}`,
        focusId: createRecordFocusId("activity", activity.id),
        label: "활동",
        tags: [activity.placeName, activity.food, activity.memo].filter(Boolean) as string[],
        title: activity.title,
        type: "activity",
      });
      person.expenses.push(...linkedExpenses);
      person.logs.push(...linkedLogs);
      person.photos.push(...linkedPhotos);
      if (activity.placeName) person.places.push(activity.placeName);
    }
  }

  return [...people.values()]
    .map((person) => ({
      ...person,
      expenseTotal: person.expenses.reduce((sum, expense) => sum + expense.amount, 0),
      items: person.items.sort((a, b) => b.date.localeCompare(a.date)),
      places: [...new Set(person.places)],
    }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}
