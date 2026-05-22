import { AppShell } from "@/components/layout/AppShell";
import { TodayView } from "@/features/today/TodayView";

export default function Home() {
  return (
    <AppShell activeKey="today">
      <TodayView />
    </AppShell>
  );
}
