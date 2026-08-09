import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeHealthPage() {
  return (
    <AppShell activeKey="capture">
      <LifeView mode="health" />
    </AppShell>
  );
}
