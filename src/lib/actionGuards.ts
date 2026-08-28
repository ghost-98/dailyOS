export function confirmAction(message: string) {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
