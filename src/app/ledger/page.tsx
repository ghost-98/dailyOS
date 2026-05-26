import { redirect } from "next/navigation";

export default function LedgerPage() {
  redirect("/life?view=list");
}
