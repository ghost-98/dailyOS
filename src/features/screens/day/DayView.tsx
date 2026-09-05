"use client";

import { DayCalendarView } from "@/features/screens/day/calendar/DayCalendarView";
import { formatDateKey } from "@/features/calendar/dateUtils";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { confirmAction } from "@/lib/actionGuards";
import { useRouter } from "next/navigation";

type DayViewProps = {
  initialDate?: string;
};

export function DayView({ initialDate }: DayViewProps) {
  return <div className="life-page"><DayDataRouter initialDate={initialDate} /></div>;
}

function DayDataRouter({ initialDate }: { initialDate?: string }) {
  const router = useRouter();
  const { data, externalItems, mutations } = useRecordsDataState();

  const dayActions = {
    editActivity: async (id: string) => {
      router.push(`/m/record?edit=activity&id=${encodeURIComponent(id)}`);
    },
    deleteActivity: async (id: string) => {
      const activity = data.activities.find((item) => item.id === id);
      if (!activity || !confirmAction(`"${activity.title}" 활동을 삭제할까요?`)) return;
      await mutations.deleteActivity(id);
    },
    editPhoto: async (id: string) => {
      router.push(`/m/record?edit=photo&id=${encodeURIComponent(id)}`);
    },
    deletePhoto: async (id: string) => {
      const photo = data.lifePhotos.find((item) => item.id === id);
      if (!photo || !confirmAction("이 사진을 삭제할까요? 파일도 함께 삭제됩니다.")) return;
      await mutations.deleteLifePhoto(photo);
    },
    editLog: async (id: string) => {
      router.push(`/m/record?edit=log&id=${encodeURIComponent(id)}`);
    },
    deleteLog: async (id: string) => {
      const log = data.dailyLogs.find((item) => item.id === id);
      if (!log || !confirmAction("이 하루 기록을 삭제할까요?")) return;
      await mutations.deleteDailyLog(id);
    },
    editIncome: async (id: string) => {
      router.push(`/m/record?edit=income&id=${encodeURIComponent(id)}`);
    },
    deleteIncome: async (id: string) => {
      const income = data.incomes.find((item) => item.id === id);
      if (!income || !confirmAction(`"${income.title}" 수입을 삭제할까요?`)) return;
      await mutations.deleteIncome(id);
    },
    editTask: async (task: typeof data.tasks[number]) => {
      router.push(`/m/record?edit=task&id=${encodeURIComponent(task.id)}`);
    },
    deleteTask: async (id: string) => {
      const task = data.tasks.find((item) => item.id === id);
      if (!task || !confirmAction(`"${task.title}" 할 일을 삭제할까요?`)) return;
      await mutations.deleteTask(id);
    },
    editEvent: async (event: typeof data.events[number]) => {
      router.push(`/m/record?edit=event&id=${encodeURIComponent(event.id)}`);
    },
    deleteEvent: async (id: string) => {
      const event = data.events.find((item) => item.id === id);
      if (!event || !confirmAction(`"${event.title}" 이벤트를 삭제할까요?`)) return;
      await mutations.deleteEvent(id);
    },
    toggleTask: async (task: typeof data.tasks[number]) => {
      const isDone = task.status === "done";
      await mutations.updateTask({
        ...task,
        completedAt: isDone ? undefined : new Date().toISOString(),
        status: isDone ? "todo" : "done",
      });
    },
  };

  return (
    <div className="life-axis-view">
      <DayCalendarView
        allowedTypes={["event", "todo"]}
        defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
        externalItems={externalItems}
        dayActions={dayActions}
      />
    </div>
  );
}






