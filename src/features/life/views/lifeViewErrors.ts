export function getLifeActionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message) return message;

  const detail = getLifePhotoErrorDebugInfo(error);
  return detail && detail !== "{}" ? `${fallback} ${detail}` : fallback;
}

export function getLifePhotoUploadErrorMessage(error: unknown) {
  const detail = getLifePhotoErrorDebugInfo(error);
  if (detail && detail !== "{}") return detail;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message.includes("Bucket not found") || message.includes("life-media")) return "사진 저장소(life-media)가 아직 없습니다. Supabase SQL 스키마를 먼저 적용해주세요.";
  if (message.includes("life_photos") || message.includes("column") || message.includes("relation")) return "사진 메타데이터 DB(life_photos)가 아직 준비되지 않았습니다. Supabase SQL 스키마를 적용해주세요.";
  if (message.includes("row-level security") || message.includes("policy")) return "스토리지/DB 권한 정책에 막혔습니다. 로그인 상태와 Supabase RLS 정책을 확인해주세요.";
  if (message.includes("auth") || message.includes("User not found")) return "로그인 정보를 확인할 수 없어 업로드하지 못했습니다. 다시 로그인해주세요.";
  return message || "사진 업로드 중 알 수 없는 오류가 발생했습니다.";
}

export function getLifePhotoErrorDebugInfo(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return String(error);

  const entries = Object.getOwnPropertyNames(error)
    .map((key) => [key, (error as Record<string, unknown>)[key]])
    .filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length > 0) return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");

  try {
    return JSON.stringify(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}
