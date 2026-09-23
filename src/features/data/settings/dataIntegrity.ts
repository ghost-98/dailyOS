import { deleteExpenseRecordFromDb } from "@/features/data/ledger/api";
import { updateDailyLogInDb, updateLifeActivityInDb, updateLifePhotoDetailsInDb } from "@/features/data/records/api";
import { createDayRecordHref, createRecordFocusId } from "@/features/records/navigation/recordDeepLink";
import type { RecordDataSnapshot } from "@/features/records/state/recordsDataLoader";

export type DataIntegrityIssue = {
  description: string;
  href?: string;
  id: string;
  recordId: string;
  repair: "delete-expense" | "unlink-activity" | "unlink-log" | "unlink-photo" | null;
  severity: "warning" | "notice";
  title: string;
};

export function inspectDataIntegrity(data: RecordDataSnapshot) {
  const issues: DataIntegrityIssue[] = [];
  const targets = {
    activity: new Set(data.activities.map((item) => item.id)),
    event: new Set(data.events.map((item) => item.id)),
    todo: new Set(data.tasks.map((item) => item.id)),
  };
  const targetExists = (type: unknown, id: unknown) => {
    if ((type !== "activity" && type !== "event" && type !== "todo") || typeof id !== "string" || !id) return false;
    return targets[type].has(id);
  };

  data.expenses.forEach((expense) => {
    if (targetExists(expense.targetType, expense.targetId)) return;
    issues.push({
      description: "연결된 활동·할 일·이벤트가 존재하지 않습니다.",
      href: createDayRecordHref(expense.date, createRecordFocusId("expense", expense.id)),
      id: `orphan-expense-${expense.id}`,
      recordId: expense.id,
      repair: "delete-expense",
      severity: "warning",
      title: `고아 지출 · ${expense.title}`,
    });
  });

  const expensesByTarget = new Map<string, typeof data.expenses>();
  data.expenses.forEach((expense) => {
    if (!targetExists(expense.targetType, expense.targetId)) return;
    const key = `${String(expense.targetType)}:${String(expense.targetId)}`;
    expensesByTarget.set(key, [...(expensesByTarget.get(key) ?? []), expense]);
  });
  expensesByTarget.forEach((expenses) => {
    expenses.slice(1).forEach((expense) => issues.push({
      description: "같은 원본 기록에 연동 지출이 두 개 이상 있습니다.",
      href: createDayRecordHref(expense.date, createRecordFocusId("expense", expense.id)),
      id: `duplicate-expense-${expense.id}`,
      recordId: expense.id,
      repair: "delete-expense",
      severity: "warning",
      title: `중복 연동 지출 · ${expense.title}`,
    }));
  });

  data.dailyLogs.forEach((log) => {
    if (!log.linkedTargetId || !log.linkedTargetType || targetExists(log.linkedTargetType, log.linkedTargetId)) return;
    issues.push({ description: "연결 대상이 사라져 기록의 연결 정보만 해제할 수 있습니다.", href: createDayRecordHref(log.date, createRecordFocusId("daily_log", log.id)), id: `orphan-log-${log.id}`, recordId: log.id, repair: "unlink-log", severity: "warning", title: "고아 하루 기록 연결" });
  });

  data.lifePhotos.forEach((photo) => {
    if (!photo.filePath?.trim()) issues.push({ description: "Storage 파일 경로가 비어 있어 자동 정리하지 않습니다.", href: createDayRecordHref(photo.date, createRecordFocusId("photo", photo.id)), id: `photo-path-${photo.id}`, recordId: photo.id, repair: null, severity: "notice", title: `사진 경로 확인 · ${photo.caption || photo.fileName || "파일명 없음"}` });
    if (!photo.linkedTargetId || !photo.linkedTargetType || targetExists(photo.linkedTargetType, photo.linkedTargetId)) return;
    issues.push({ description: "연결 대상이 사라져 사진의 연결 정보만 해제할 수 있습니다.", href: createDayRecordHref(photo.date, createRecordFocusId("photo", photo.id)), id: `orphan-photo-${photo.id}`, recordId: photo.id, repair: "unlink-photo", severity: "warning", title: `고아 사진 연결 · ${photo.caption || photo.fileName}` });
  });

  data.activities.forEach((activity) => {
    if (!activity.sourceId || !activity.sourceType || targetExists(activity.sourceType, activity.sourceId)) return;
    issues.push({ description: "원본은 없지만 활동 자체는 유지하고 원본 연결만 해제할 수 있습니다.", href: createDayRecordHref(activity.date, createRecordFocusId("activity", activity.id)), id: `orphan-activity-${activity.id}`, recordId: activity.id, repair: "unlink-activity", severity: "warning", title: `원본 없는 활동 · ${activity.title}` });
  });

  return issues;
}

export async function repairDataIntegrity(data: RecordDataSnapshot, issues: DataIntegrityIssue[]) {
  const repairable = issues.filter((issue) => issue.repair);
  for (const issue of repairable) {
    const recordId = issue.recordId;
    if (issue.repair === "delete-expense") await deleteExpenseRecordFromDb(recordId);
    if (issue.repair === "unlink-log") {
      const log = data.dailyLogs.find((item) => item.id === recordId);
      if (log) await updateDailyLogInDb({ ...log, linkedTargetId: undefined, linkedTargetTitle: undefined, linkedTargetType: undefined });
    }
    if (issue.repair === "unlink-photo") {
      const photo = data.lifePhotos.find((item) => item.id === recordId);
      if (photo) await updateLifePhotoDetailsInDb(photo.id, photo.date, photo.caption);
    }
    if (issue.repair === "unlink-activity") {
      const activity = data.activities.find((item) => item.id === recordId);
      if (activity) await updateLifeActivityInDb({ ...activity, sourceId: undefined, sourceTitle: undefined, sourceType: undefined });
    }
  }
  return repairable.length;
}
