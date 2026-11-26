import { OtherView } from "@/features/screens/other/OtherView";

export default async function OtherPage({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  return <OtherView view={(await searchParams).view} />;
}

