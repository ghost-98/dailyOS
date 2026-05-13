import { AppShell } from "@/components/layout/AppShell";
import { CareerView } from "@/features/career/CareerView";

export default function CareerPage() {
  return (
    <AppShell activeKey="career">
      <CareerView />
    </AppShell>
  );
}
