import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default async function LifeActivitiesPage({ searchParams }: { searchParams: Promise<{ date?: string; end?: string; start?: string; title?: string }> }) {
  const { date, end, start, title } = await searchParams;
  const activityDraft = date || end || start || title
    ? { date, endTime: end, startTime: start, title }
    : undefined;

  return (
    <AppShell activeKey="capture">
      <LifeView activityDraft={activityDraft} mode="activities" />
    </AppShell>
  );
}
