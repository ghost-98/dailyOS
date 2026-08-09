import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePlansPage() {
  return (
    <AppShell activeKey="capture">
      <LifeView mode="plans" />
    </AppShell>
  );
}
