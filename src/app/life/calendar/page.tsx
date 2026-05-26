import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeCalendarPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="calendar" />
    </AppShell>
  );
}
