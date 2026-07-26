import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default async function LifeReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;

  return (
    <AppShell activeKey="life">
      <LifeView initialDate={date} mode="report" />
    </AppShell>
  );
}
