import { AppShell } from "@/components/layout/AppShell";
import { PlacesView } from "@/features/places/PlacesView";

export default function PlacesPage() {
  return (
    <AppShell activeKey="places">
      <PlacesView />
    </AppShell>
  );
}
