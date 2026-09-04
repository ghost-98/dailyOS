"use client";

import type { ReactNode } from "react";
import { PanelHeading } from "@/components/ui/PanelHeading";
import { SectionCard } from "@/components/ui/SectionCard";

type OtherTabShellProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  title: string;
};

export function OtherTabShell({ actions, children, className = "", title }: OtherTabShellProps) {
  return (
    <SectionCard className={`other-tab-shell ui-workspace-panel ${className}`.trim()}>
      <PanelHeading actions={actions} title={title} />
      <div className="other-tab-shell__body">{children}</div>
    </SectionCard>
  );
}
