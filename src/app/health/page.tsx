import { AppShell } from "@/components/layout/AppShell";
import { HealthView } from "@/features/health/HealthView";

export default function HealthPage() {
  return (
    <AppShell activeKey="health">
      <HealthView />
    </AppShell>
  );
}
