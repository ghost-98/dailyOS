import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeAskPage() {
  return (
    <AppShell activeKey="life-ask">
      <LifeView mode="ask" />
    </AppShell>
  );
}
