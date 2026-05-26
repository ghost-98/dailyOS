import { redirect } from "next/navigation";

export default function HealthPage() {
  redirect("/life?view=list");
}
