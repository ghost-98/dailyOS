import { redirect } from "next/navigation";

export default function PlacesPage() {
  redirect("/life?view=map");
}
