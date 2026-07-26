import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePlacesFlowPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="places" />
    </AppShell>
  );
}
