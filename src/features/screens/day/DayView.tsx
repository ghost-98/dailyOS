"use client";

import { CalendarView } from "@/features/screens/calendar/CalendarView";
import { formatDateKey } from "@/features/life/dateTime";
import { useLifeDataState } from "@/features/life/useLifeDataState";
import type { LifeViewMode } from "@/features/life/modes";
import { DayGalleryView } from "@/features/screens/day/DayGalleryView";
import { DayPeopleView } from "@/features/screens/day/DayPeopleView";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type DayViewProps = {
  initialDate?: string;
  mode: LifeViewMode;
};

export function DayView({ initialDate, mode }: DayViewProps) {
  const { isReady } = useResponsiveMode();

  if (!isReady) {
    return <div className="life-page life-page--responsive-pending" />;
  }

  return <div className="life-page"><DayDataRouter activeTab={mode} initialDate={initialDate} /></div>;
}

function DayDataRouter({ activeTab, initialDate }: { activeTab: LifeViewMode; initialDate?: string }) {
  const { data, externalItems, mutations } = useLifeDataState();
  const { activities, dailyLogs, events, expenses, lifePhotos, tasks } = data;

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

  if (activeTab === "people") {
    return (
      <div className="life-axis-view">
        <DayPeopleView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} />
      </div>
    );
  }

  if (activeTab === "gallery") {
    return (
      <div className="life-axis-view">
        <DayGalleryView onDeletePhoto={mutations.deleteLifePhoto} photos={lifePhotos} />
      </div>
    );
  }

  return (
    <div className="life-axis-view">
      <CalendarView
        allowedTypes={["event", "todo"]}
        defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
        externalItems={externalItems}
        showEventAddButton={false}
        title="하루"
        viewMode="manage"
      />
    </div>
  );
}
