"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";

export function SignalCard({ icon, label, note, value }: { icon: ReactNode; label: string; note: string; value: string }) {
  return (
    <SectionCard className="today-focus-card today-signal-card">
      <span className="today-signal-card__icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </SectionCard>
  );
}

export function QuickAction({ href, icon, label, note }: { href: string; icon: ReactNode; label: string; note: string }) {
  return (
    <Link className="today-quick-action" href={href}>
      <span>
        {icon}
        <Plus aria-hidden size={14} />
      </span>
      <strong>{label}</strong>
      <p>{note}</p>
    </Link>
  );
}

export function DashboardHeader({
  href,
  icon,
  openLabel,
  title,
  trailing,
}: {
  href: string;
  icon: ReactNode;
  openLabel: string;
  title: string;
  trailing?: string;
}) {
  return (
    <div className="section-heading">
      <div className="card-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="today-heading-actions">
        {trailing ? <strong>{trailing}</strong> : null}
        <Link className="empty-dashboard-link" href={href}>
          {openLabel}
        </Link>
      </div>
    </div>
  );
}

export function EmptyBlock({ ctaLabel, href, text: message }: { ctaLabel: string; href: string; text: string }) {
  return (
    <div className="today-empty-block">
      <p>{message}</p>
      <Link className="empty-dashboard-link" href={href}>
        {ctaLabel}
      </Link>
    </div>
  );
}
