import { redirect } from "next/navigation";

export default function SchedulePage() {
  redirect("/life?view=calendar");
}
