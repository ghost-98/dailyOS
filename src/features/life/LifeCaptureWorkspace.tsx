"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CaptureTabBar, type CaptureTab } from "@/features/life/components/CaptureTabBar";
import type { LifeActivityDraft } from "@/features/life/views/LifeActivitiesView";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { useLifeDataState } from "@/features/life/useLifeDataState";
import { formatDateKey } from "@/features/life/dateTime";

type LifeCaptureWorkspaceProps = {
  activityDraft?: LifeActivityDraft;
  initialTab: CaptureTab;
};

const LifeActivitiesView = dynamic(() => import("@/features/life/views/LifeActivitiesView").then((module) => module.LifeActivitiesView), {
  loading: () => <div className="life-capture-workspace__loading" />,
  ssr: false,
});

const LifeHealthView = dynamic(() => import("@/features/life/views/LifeHealthView").then((module) => module.LifeHealthView), {
  loading: () => <div className="life-capture-workspace__loading" />,
  ssr: false,
});

const LifeLogsView = dynamic(() => import("@/features/life/views/LifeLogsView").then((module) => module.LifeLogsView), {
  loading: () => <div className="life-capture-workspace__loading" />,
  ssr: false,
});

const CalendarView = dynamic(() => import("@/features/calendar/CalendarView").then((module) => module.CalendarView), {
  loading: () => <div className="life-capture-workspace__loading" />,
  ssr: false,
});

export function LifeCaptureWorkspace({ activityDraft, initialTab }: LifeCaptureWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<CaptureTab>(initialTab);
  const { data, mutations, setData } = useLifeDataState();
  const { isReady } = useResponsiveMode();
  const { activities, dailyLogs, events, tasks, weights, workouts } = data;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isReady) {
    return <div className="life-axis-view life-capture-workspace life-capture-workspace--responsive-pending" />;
  }

  return (
    <div className="life-axis-view life-capture-workspace">
      <CaptureTabBar activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === "plans" ? (
        <CalendarView allowedTypes={["event", "todo"]} defaultSelectedDate={formatDateKey(new Date())} showEventAddButton title="할 일·이벤트" viewMode="manage" />
      ) : activeTab === "logs" ? (
        <LifeLogsView
          activities={activities}
          events={events}
          logs={dailyLogs}
          onCreateLog={mutations.createDailyLog}
          onDeleteLog={mutations.deleteDailyLog}
          onUpdateLog={mutations.updateDailyLog}
          tasks={tasks}
        />
      ) : activeTab === "health" ? (
        <LifeHealthView
          setWeights={(updater) => setData((current) => ({ ...current, weights: typeof updater === "function" ? updater(current.weights) : updater }))}
          setWorkouts={(updater) => setData((current) => ({ ...current, workouts: typeof updater === "function" ? updater(current.workouts) : updater }))}
          weights={weights}
          workouts={workouts}
        />
      ) : (
        <LifeActivitiesView
          activities={activities}
          initialDraft={activityDraft}
          onDeleteActivity={mutations.deleteActivity}
          onSaveActivity={mutations.saveActivity}
          onUploadPhotos={mutations.uploadLifePhotos}
        />
      )}
    </div>
  );
}
