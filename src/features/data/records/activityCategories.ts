import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";

export async function fetchActivityCategoriesFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase.from("activity_categories").select("name").eq("user_id", userId).order("name");
  if (error) throw error;
  return (data as Array<{ name: string }>).map((row) => row.name);
}

export async function createActivityCategoryInDb(name: string) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  const normalizedName = name.trim();
  if (!userId || !normalizedName) return null;
  const { data, error } = await supabase
    .from("activity_categories")
    .upsert({ name: normalizedName, user_id: userId }, { onConflict: "user_id,name" })
    .select("name")
    .single();
  if (error) throw error;
  return (data as { name: string }).name;
}

export async function deleteActivityCategoryFromDb(name: string) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { error } = await supabase.from("activity_categories").delete().eq("user_id", userId).eq("name", name);
  if (error) throw error;
  return true;
}
