import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifePhotosPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="photos" />
    </AppShell>
  );
}
