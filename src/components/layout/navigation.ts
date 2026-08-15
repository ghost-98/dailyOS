import { Activity, BookOpenCheck, Grid2X2, Layers3, Map, MapPinned, Settings } from "lucide-react";

export type NavItem = {
  children?: Array<Omit<NavItem, "children" | "icon">>;
  href: string;
  icon: typeof Grid2X2;
  key: string;
  label: string;
};

const captureChildren = [
  { label: "활동 기록", href: "/life/activities", key: "life-activities" },
  { label: "할 일·이벤트", href: "/life/plans", key: "life-plans" },
  { label: "하루기록", href: "/life/logs", key: "life-logs" },
  { label: "건강", href: "/life/health", key: "life-health" },
];

const lifeChildren = [
  { label: "라이프 캘린더", href: "/life/calendar", key: "life-calendar" },
  { label: "갤러리", href: "/life/gallery", key: "life-gallery" },
  { label: "전체 검색", href: "/life/search", key: "life-search" },
  { label: "사람", href: "/life/people", key: "life-people" },
  { label: "장소", href: "/life/places", key: "life-places" },
  { label: "AI 질문", href: "/life/ask", key: "life-ask" },
  { label: "가계부", href: "/ledger", key: "ledger" },
];

const placeChildren = [
  { label: "장소 보관함", href: "/places", key: "places-vault" },
];

export const primaryNav: NavItem[] = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "기록", href: "/life/activities", key: "capture", icon: Activity, children: captureChildren },
  { label: "DB", href: "/life", key: "life", icon: Layers3, children: lifeChildren },
  { label: "장소", href: "/places", key: "places", icon: MapPinned, children: placeChildren },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];

export const mobileNav: NavItem[] = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "기록", href: "/life/activities", key: "life-activities", icon: Activity },
  { label: "DB", href: "/life", key: "life", icon: BookOpenCheck },
  { label: "장소", href: "/places", key: "places", icon: Map },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];
