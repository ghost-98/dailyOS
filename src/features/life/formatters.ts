export function formatWon(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

export function formatRunDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  if (minutes <= 0) return `${seconds}초`;
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
}

export function formatWeightMeasurementMeta(measuredAtTime?: string, measuredFasted = true) {
  const parts: string[] = [];
  if (measuredAtTime) parts.push(measuredAtTime);
  parts.push(measuredFasted ? "6시간 이상 공복" : "공복 미충족");
  return parts.join(" · ");
}

export function getLinkedTargetTypeLabel(type?: "todo" | "event" | "activity" | "photo" | "daily_log") {
  if (type === "todo") return "할 일";
  if (type === "event") return "이벤트";
  if (type === "activity") return "활동";
  return "날짜";
}
