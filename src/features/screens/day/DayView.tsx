"use client";

import { CalendarView } from "@/features/screens/calendar/CalendarView";
import { formatDateKey } from "@/features/records/time/recordDateTime";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { confirmAction } from "@/lib/actionGuards";

type DayViewProps = {
  initialDate?: string;
};

export function DayView({ initialDate }: DayViewProps) {
  return <div className="life-page"><DayDataRouter initialDate={initialDate} /></div>;
}

function DayDataRouter({ initialDate }: { initialDate?: string }) {
  const { data, externalItems, mutations } = useRecordsDataState();

  const dayActions = {
    editActivity: async (id: string) => {
      const activity = data.activities.find((item) => item.id === id);
      if (!activity) return;
      const title = window.prompt("활동 제목을 수정하세요.", activity.title)?.trim();
      if (!title || title === activity.title) return;
      await mutations.saveActivity({ ...activity, title });
    },
    deleteActivity: async (id: string) => {
      const activity = data.activities.find((item) => item.id === id);
      if (!activity || !confirmAction(`"${activity.title}" 활동을 삭제할까요?`)) return;
      await mutations.deleteActivity(id);
    },
    editPhoto: async (id: string) => {
      const photo = data.lifePhotos.find((item) => item.id === id);
      if (!photo) return;
      const caption = window.prompt("사진 설명을 수정하세요.", photo.caption ?? "");
      if (caption === null || caption.trim() === (photo.caption ?? "")) return;
      await mutations.updateLifePhotoCaption(id, caption.trim() || undefined);
    },
    deletePhoto: async (id: string) => {
      const photo = data.lifePhotos.find((item) => item.id === id);
      if (!photo || !confirmAction("이 사진을 삭제할까요? 파일도 함께 삭제됩니다.")) return;
      await mutations.deleteLifePhoto(photo);
    },
    editLog: async (id: string) => {
      const log = data.dailyLogs.find((item) => item.id === id);
      if (!log) return;
      const content = window.prompt("하루 기록을 수정하세요.", log.content)?.trim();
      if (!content || content === log.content) return;
      await mutations.updateDailyLog({ ...log, content });
    },
    deleteLog: async (id: string) => {
      const log = data.dailyLogs.find((item) => item.id === id);
      if (!log || !confirmAction("이 하루 기록을 삭제할까요?")) return;
      await mutations.deleteDailyLog(id);
    },
    editIncome: async (id: string) => {
      const income = data.incomes.find((item) => item.id === id);
      if (!income) return;
      const title = window.prompt("수입 항목을 수정하세요.", income.title)?.trim();
      if (!title) return;
      const amountText = window.prompt("수입 금액을 입력하세요.", String(income.amount));
      if (amountText === null) return;
      const amount = Number(amountText.replace(/[^\d]/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) return;
      await mutations.updateIncome({ ...income, amount, title });
    },
    deleteIncome: async (id: string) => {
      const income = data.incomes.find((item) => item.id === id);
      if (!income || !confirmAction(`"${income.title}" 수입을 삭제할까요?`)) return;
      await mutations.deleteIncome(id);
    },
  };

  return (
    <div className="life-axis-view">
      <CalendarView
        allowedTypes={["event", "todo"]}
        defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
        externalItems={externalItems}
        dayActions={dayActions}
      />
    </div>
  );
}






