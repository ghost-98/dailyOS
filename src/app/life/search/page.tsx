import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeSearchPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="search" />
    </AppShell>
  );
}
