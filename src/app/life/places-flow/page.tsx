import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePlacesFlowPage() {
  return (
    <AppShell activeKey="places">
      <LifeView mode="places" />
    </AppShell>
  );
}
