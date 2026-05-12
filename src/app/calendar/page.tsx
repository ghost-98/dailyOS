import { AppShell } from "@/components/layout/AppShell";
import { CalendarView } from "@/features/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <AppShell activeKey="calendar">
      <CalendarView />
    </AppShell>
  );
}
