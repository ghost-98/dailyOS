"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarCheck2, HeartPulse, NotebookPen } from "lucide-react";

const recordTabs = [
  { href: "/life/activities", icon: Activity, label: "활동" },
  { href: "/life/plans", icon: CalendarCheck2, label: "할 일" },
  { href: "/life/logs", icon: NotebookPen, label: "메모" },
  { href: "/life/health", icon: HeartPulse, label: "건강" },
];

export function MobileRecordNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="기록 전환" className="mobile-record-nav">
      {recordTabs.map((tab) => (
        <Link className={pathname === tab.href ? "mobile-record-nav__item mobile-record-nav__item--active" : "mobile-record-nav__item"} href={tab.href} key={tab.href}>
          <tab.icon aria-hidden size={15} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
