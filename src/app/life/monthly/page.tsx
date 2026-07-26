import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeMonthlyPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="monthly" />
    </AppShell>
  );
}
