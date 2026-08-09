import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePlacesPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="places" />
    </AppShell>
  );
}
