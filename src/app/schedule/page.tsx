import { AppShell } from "@/components/layout/AppShell";
import { CalendarView } from "@/features/calendar/CalendarView";

export default function SchedulePage() {
  return (
    <AppShell activeKey="schedule">
      <CalendarView
        allowedTypes={["schedule", "event", "todo"]}
        showEventAddButton
        title="시간 관리"
      />
    </AppShell>
  );
}
