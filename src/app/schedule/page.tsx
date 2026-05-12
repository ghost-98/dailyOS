import { AppShell } from "@/components/layout/AppShell";
import { CalendarView } from "@/features/calendar/CalendarView";

export default function SchedulePage() {
  return (
    <AppShell activeKey="schedule">
      <CalendarView
        addButtonLabel="일정 추가"
        description="일정, 할 일, 건강, 취업 날짜를 달력에서 확인합니다."
        title="일정"
      />
    </AppShell>
  );
}
