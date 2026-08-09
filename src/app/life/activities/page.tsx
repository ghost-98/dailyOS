import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default async function LifeActivitiesPage({ searchParams }: { searchParams: Promise<{ date?: string; end?: string; start?: string; title?: string }> }) {
  const { date, end, start, title } = await searchParams;

  return (
    <AppShell activeKey="capture">
      <LifeView activityDraft={{ date, endTime: end, startTime: start, title }} mode="activities" />
    </AppShell>
  );
}
