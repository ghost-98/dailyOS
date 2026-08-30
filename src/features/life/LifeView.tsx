"use client";

import { useRouter } from "next/navigation";
import { CalendarView } from "@/features/calendar/CalendarView";
import { formatDateKey } from "@/features/life/dateTime";
import { LifeCaptureWorkspace } from "@/features/life/LifeCaptureWorkspace";
import type { LifeDataMode, LifeViewMode } from "@/features/life/modes";
import { useLifeDataState } from "@/features/life/useLifeDataState";
import type { LifeActivityDraft } from "@/features/life/views/LifeActivitiesView";
import { LifeAskView } from "@/features/life/views/LifeAskView";
import { LifeGalleryView } from "@/features/life/views/LifeGalleryView";
import { LifePeopleView } from "@/features/life/views/LifePeopleView";
import { LifePlacesView } from "@/features/life/views/LifePlacesView";
import { LifeSearchView } from "@/features/life/views/LifeSearchView";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type LifeViewProps = {
  activityDraft?: LifeActivityDraft;
  initialDate?: string;
  mode: LifeViewMode;
};

export function LifeView({ activityDraft, initialDate, mode }: LifeViewProps) {
  const { isReady } = useResponsiveMode();

  if (!isReady) {
    return <div className="life-page life-page--responsive-pending" />;
  }

  return <div className="life-page"><LifeDataRouter activeTab={mode} activityDraft={activityDraft} initialDate={initialDate} /></div>;
}

function LifeDataRouter({ activeTab, activityDraft, initialDate }: { activeTab: LifeDataMode; activityDraft?: LifeActivityDraft; initialDate?: string }) {
  const router = useRouter();
  const { data, externalItems, mutations } = useLifeDataState();
  const { activities, dailyLogs, events, expenses, incomes, lifePhotos, tasks, weights, workouts } = data;

  if (activeTab === "calendar") {
    return (
      <div className="life-axis-view">
        <CalendarView
          allowedTypes={["event", "todo"]}
          defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
          externalItems={externalItems}
          showEventAddButton={false}
          title="라이프 캘린더"
          viewMode="database"
        />
      </div>
    );
  }

  if (activeTab === "search") {
    return (
      <div className="life-axis-view">
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
      </div>
    );
  }

  if (activeTab === "places") {
    return (
      <div className="life-axis-view">
        <LifePlacesView activities={activities} dailyLogs={dailyLogs} photos={lifePhotos} />
      </div>
    );
  }

  if (activeTab === "people") {
    return (
      <div className="life-axis-view">
        <LifePeopleView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} />
      </div>
    );
  }

  if (activeTab === "ask") {
    return (
      <div className="life-axis-view">
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
      </div>
    );
  }

  if (activeTab === "gallery") {
    return (
      <div className="life-axis-view">
        <LifeGalleryView onDeletePhoto={mutations.deleteLifePhoto} photos={lifePhotos} />
      </div>
    );
  }

  return <LifeCaptureWorkspace activityDraft={activityDraft} initialTab={activeTab} />;
}
