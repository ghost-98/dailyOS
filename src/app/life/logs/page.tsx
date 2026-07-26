import { AppShell } from "@/components/layout/AppShell";
import { LifeView } from "@/features/life/LifeView";

export default function LifeLogsPage() {
  return (
    <AppShell activeKey="life">
      <LifeView mode="logs" />
    </AppShell>
  );
}
