"use client";

import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/SectionCard";

type OtherTabShellProps = {
  children?: ReactNode;
  className?: string;
  title: string;
};

export function OtherTabShell({ children, className = "", title }: OtherTabShellProps) {
  return (
    <SectionCard className={`other-tab-shell ui-workspace-panel ${className}`.trim()}>
      <div className="section-heading ui-panel-heading ui-panel-heading--compact other-tab-shell__head">
        <p className="eyebrow">{title}</p>
      </div>
      <div className="other-tab-shell__body">{children}</div>
    </SectionCard>
  );
}
