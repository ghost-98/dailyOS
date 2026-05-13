import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CareerView } from "@/features/career/CareerView";
import type { CareerTab } from "@/features/career/data";

const careerTabs: CareerTab[] = ["applied", "planned", "certificates", "resumes"];

type CareerTabPageProps = {
  params: Promise<{
    tab: string;
  }>;
};

export function generateStaticParams() {
  return careerTabs.map((tab) => ({ tab }));
}

export default async function CareerTabPage({ params }: CareerTabPageProps) {
  const { tab } = await params;

  if (!isCareerTab(tab)) {
    notFound();
  }

  return (
    <AppShell activeKey="career">
      <CareerView activeTab={tab} />
    </AppShell>
  );
}

function isCareerTab(value: string): value is CareerTab {
  return careerTabs.includes(value as CareerTab);
}
