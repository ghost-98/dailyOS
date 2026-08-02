import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePeoplePage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="people" />
    </AppShell>
  );
}
