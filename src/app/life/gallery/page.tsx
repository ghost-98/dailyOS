import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeGalleryPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="gallery" />
    </AppShell>
  );
}
