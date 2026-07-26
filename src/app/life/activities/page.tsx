import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeActivitiesPage() {
  return (
    <AppShell activeKey="capture">
      <LifeView mode="activities" />
    </AppShell>
  );
}
