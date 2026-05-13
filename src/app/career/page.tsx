import { AppShell } from "@/components/layout/AppShell";
import { CareerView } from "@/features/career/CareerView";
import { Suspense } from "react";

export default function CareerPage() {
  return (
    <AppShell activeKey="career">
      <Suspense fallback={null}>
        <CareerView />
      </Suspense>
    </AppShell>
  );
}
