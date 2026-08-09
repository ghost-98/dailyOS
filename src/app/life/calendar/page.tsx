import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default async function LifeCalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;

  return (
    <AppShell activeKey="life-calendar">
      <LifeView initialDate={date} mode="calendar" />
    </AppShell>
  );
}
