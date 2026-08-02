import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePhotosPage() {
  return (
    <AppShell activeKey="capture">
      <LifeView mode="photos" />
    </AppShell>
  );
}
