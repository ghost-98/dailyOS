import { supabase } from "@/lib/supabase";

export async function getCurrentUserId() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function requireCurrentUser() {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("로그인이 필요합니다.");
  return data.user;
}
