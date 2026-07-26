import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeMapPage() {
  return (
    <AppShell activeKey="places">
      <LifeView mode="map" />
    </AppShell>
  );
}
