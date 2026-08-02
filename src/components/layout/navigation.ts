import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Grid2X2,
  Layers3,
  Map,
  MapPinned,
  NotebookPen,
  ReceiptText,
  Settings,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  children?: Array<Omit<NavItem, "children" | "icon">>;
  href: string;
  icon: typeof Grid2X2;
  key: string;
  label: string;
};

const lifeChildren = [
  { label: "캘린더", href: "/life/calendar", key: "life-calendar" },
  { label: "하루 리포트", href: "/life/report", key: "life-report" },
  { label: "월간 회고", href: "/life/monthly", key: "life-monthly" },
  { label: "전체 검색", href: "/life/search", key: "life-search" },
  { label: "사람", href: "/life/people", key: "life-people" },
  { label: "AI 질문", href: "/life/ask", key: "life-ask" },
];

const captureChildren = [
  { label: "일정·할일", href: "/life/calendar", key: "life-capture-calendar" },
  { label: "활동 기록", href: "/life/activities", key: "life-activities" },
  { label: "하루기록", href: "/life/logs", key: "life-logs" },
  { label: "사진", href: "/life/photos", key: "life-photos" },
  { label: "건강", href: "/life/health", key: "life-health" },
];

const placeChildren = [
  { label: "장소 보관함", href: "/places", key: "places-vault" },
  { label: "장소 흐름", href: "/life/places-flow", key: "life-places-flow" },
  { label: "장소 지도", href: "/life/map", key: "life-map" },
];

const careerChildren = [
  { label: "지원한 기업", href: "/career/applied", key: "applied" },
  { label: "지원 예정", href: "/career/planned", key: "planned" },
  { label: "자격증", href: "/career/certificates", key: "certificates" },
];

export const primaryNav: NavItem[] = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "라이프 DB", href: "/life", key: "life", icon: Layers3, children: lifeChildren },
  { label: "기록 입력", href: "/life/activities", key: "capture", icon: NotebookPen, children: captureChildren },
  { label: "가계부", href: "/ledger", key: "ledger", icon: ReceiptText },
  { label: "장소", href: "/places", key: "places", icon: MapPinned, children: placeChildren },
  { label: "커리어", href: "/career/applied", key: "career", icon: BriefcaseBusiness, children: careerChildren },
  { label: "설정", href: "/settings", key: "settings", icon: Settings },
];

export const mobileNav: NavItem[] = [
  { label: "오늘", href: "/", key: "today", icon: Grid2X2 },
  { label: "라이프", href: "/life", key: "life", icon: Layers3 },
  { label: "캘린더", href: "/life/calendar", key: "life-calendar", icon: CalendarDays },
  { label: "기록", href: "/life/activities", key: "life-activities", icon: BookOpenCheck },
  { label: "질문", href: "/life/ask", key: "life-ask", icon: Sparkles },
  { label: "장소", href: "/places", key: "places", icon: Map },
];
