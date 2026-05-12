import { AppShell } from "@/components/layout/AppShell";
import { TodayDashboard } from "@/features/today/TodayDashboard";

export default function Home() {
  return (
    <AppShell>
      <TodayDashboard />
    </AppShell>
  );
}
