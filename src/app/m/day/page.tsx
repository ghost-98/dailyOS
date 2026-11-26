import { DayView } from "@/features/screens/day/DayView";

type DayPageProps = {
  searchParams?: Promise<{
    date?: string;
    focus?: string;
  }>;
};

export default async function DayPage({ searchParams }: DayPageProps) {
  const params = await searchParams;
  const date = params?.date;
  const initialDate = isDateKey(date) ? date : undefined;
  return <DayView initialDate={initialDate} initialFocusId={params?.focus} />;
}

function isDateKey(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
