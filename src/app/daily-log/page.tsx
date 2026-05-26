import { redirect } from "next/navigation";

export default function DailyLogPage() {
  redirect("/life?view=list");
}
