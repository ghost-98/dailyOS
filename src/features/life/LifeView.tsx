"use client";

import { useRouter } from "next/navigation";
import { CalendarView } from "@/features/calendar/CalendarView";
import { formatDateKey } from "@/features/life/dateTime";
import { LifeHomeView } from "@/features/life/LifeHomeView";
import type { LifeDataMode, LifeViewMode } from "@/features/life/modes";
import { useLifeDataState } from "@/features/life/useLifeDataState";
import { LifeActivitiesView } from "@/features/life/views/LifeActivitiesView";
import type { LifeActivityDraft } from "@/features/life/views/LifeActivitiesView";
import { LifeAskView } from "@/features/life/views/LifeAskView";
import { LifeHealthView } from "@/features/life/views/LifeHealthView";
import { LifeGalleryView } from "@/features/life/views/LifeGalleryView";
import { LifeLogsView } from "@/features/life/views/LifeLogsView";
import { LifePeopleView } from "@/features/life/views/LifePeopleView";
import { LifePlacesView } from "@/features/life/views/LifePlacesView";
import { LifeSearchView } from "@/features/life/views/LifeSearchView";

type LifeViewProps = {
  activityDraft?: LifeActivityDraft;
  initialDate?: string;
  mode: LifeViewMode;
};

export function LifeView({ activityDraft, initialDate, mode }: LifeViewProps) {
  return <div className="life-page">{mode === "home" ? <LifeHomeView /> : <LifeDataRouter activeTab={mode} activityDraft={activityDraft} initialDate={initialDate} />}</div>;
}

function LifeDataRouter({ activeTab, activityDraft, initialDate }: { activeTab: LifeDataMode; activityDraft?: LifeActivityDraft; initialDate?: string }) {
  const router = useRouter();
  const { data, externalItems, mutations, setData } = useLifeDataState(activeTab);
  const { activities, dailyLogs, events, expenses, incomes, lifePhotos, tasks, weights, workouts } = data;

  if (activeTab === "plans") {
    return (
      <div className="life-axis-view">
        <CalendarView
          allowedTypes={["event", "todo"]}
          defaultSelectedDate={formatDateKey(new Date())}
          description="할 일과 중요한 이벤트를 기록하고 관리합니다. 실제로 끝난 것은 활동 기록으로 전환할 수 있습니다."
          showEventAddButton
          title="할 일·이벤트"
          viewMode="manage"
        />
      </div>
    );
  }

  if (activeTab === "calendar") {
    return (
      <div className="life-axis-view">
        <CalendarView
          allowedTypes={["event", "todo"]}
          defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
          description="이벤트와 할 일을 날짜별로 묶고, 필요한 항목을 바로 추가하세요."
          externalItems={externalItems}
          showEventAddButton={false}
          title="라이프 캘린더"
          viewMode="database"
        />
      </div>
    );
  }

  return (
    <div className="life-axis-view">
      {activeTab === "search" ? (
        <LifeSearchView
          activities={activities}
          dailyLogs={dailyLogs}
          events={events}
          expenses={expenses}
          incomes={incomes}
          onOpenDate={(date) => router.push(`/life/calendar?date=${date}`)}
          photos={lifePhotos}
          tasks={tasks}
          weights={weights}
          workouts={workouts}
        />
      ) : activeTab === "places" ? (
        <LifePlacesView activities={activities} dailyLogs={dailyLogs} photos={lifePhotos} />
      ) : activeTab === "people" ? (
        <LifePeopleView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} />
      ) : activeTab === "ask" ? (
        <LifeAskView
          activities={activities}
          dailyLogs={dailyLogs}
          events={events}
          expenses={expenses}
          incomes={incomes}
          onOpenDate={(date) => router.push(`/life/calendar?date=${date}`)}
          photos={lifePhotos}
          tasks={tasks}
          weights={weights}
          workouts={workouts}
        />
      ) : activeTab === "activities" ? (
        <LifeActivitiesView
          activities={activities}
          initialDraft={activityDraft}
          onDeleteActivity={mutations.deleteActivity}
          onSaveActivity={mutations.saveActivity}
          onUploadPhotos={mutations.uploadLifePhotos}
        />
      ) : activeTab === "logs" ? (
        <LifeLogsView activities={activities} logs={dailyLogs} onCreateLog={mutations.createDailyLog} onDeleteLog={mutations.deleteDailyLog} onUpdateLog={mutations.updateDailyLog} />
      ) : activeTab === "gallery" ? (
        <LifeGalleryView onDeletePhoto={mutations.deleteLifePhoto} photos={lifePhotos} />
      ) : (
        <LifeHealthView
          setWeights={(updater) => setData((current) => ({ ...current, weights: typeof updater === "function" ? updater(current.weights) : updater }))}
          setWorkouts={(updater) => setData((current) => ({ ...current, workouts: typeof updater === "function" ? updater(current.workouts) : updater }))}
          weights={weights}
          workouts={workouts}
        />
      )}
    </div>
  );
}
