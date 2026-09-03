import { Activity, CalendarDays, Settings } from "lucide-react";

export type NavItem = {
  href: string;
  icon: typeof Activity;
  key: string;
  label: string;
};

export const mobileNav: NavItem[] = [
  { label: "기록", href: "/m/life/activities", key: "life-activities", icon: Activity },
  { label: "하루", href: "/m/life", key: "life", icon: CalendarDays },
  { label: "설정", href: "/m/settings", key: "settings", icon: Settings },
];

