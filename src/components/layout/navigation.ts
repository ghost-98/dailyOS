import { CalendarDays, Grid2x2, Plus, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  icon: LucideIcon;
  key: string;
  label: string;
};

export const mobileNav: NavItem[] = [
  { label: "검색", href: "/m/search", key: "search", icon: Search },
  { label: "하루", href: "/m/day", key: "day", icon: CalendarDays },
  { label: "+", href: "/m/record", key: "record", icon: Plus },
  { label: "기타", href: "/m/other", key: "other", icon: Grid2x2 },
  { label: "설정", href: "/m/settings", key: "settings", icon: Settings },
];


