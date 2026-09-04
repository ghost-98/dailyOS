"use client";

import { CalendarView } from "@/features/screens/calendar/CalendarView";
import { formatDateKey } from "@/features/records/time/recordDateTime";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";

type DayViewProps = {
  initialDate?: string;
};

export function DayView({ initialDate }: DayViewProps) {
  return <div className="life-page"><DayDataRouter initialDate={initialDate} /></div>;
}

function DayDataRouter({ initialDate }: { initialDate?: string }) {
  const { externalItems } = useRecordsDataState();

  return (
    <div className="life-axis-view">
      <CalendarView
        allowedTypes={["event", "todo"]}
        defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
        externalItems={externalItems}
      />
    </div>
  );
}






