import { AppShell } from "@/components/layout/AppShell";
import { CalendarView } from "@/features/calendar/CalendarView";

export default function SchedulePage() {
  return (
    <AppShell activeKey="schedule">
      <CalendarView
        addButtonLabel="일정 추가"
        allowedTypes={["schedule", "event", "todo"]}
        description="일정, 이벤트, 할 일을 한 달 달력에서 관리합니다."
        showEventAddButton
        title="일정"
      />
    </AppShell>
  );
}
