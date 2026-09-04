"use client";

import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

type SlideUpSheetAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
};

type SlideUpSheetProps = {
  actions?: {
    secondary?: SlideUpSheetAction;
    primary?: SlideUpSheetAction;
  };
  children: ReactNode;
  className?: string;
  eyebrow: string;
  headerActions?: ReactNode;
  eyebrowSuffix?: ReactNode;
  onClose: () => void;
};

export function SlideUpSheet({ actions, children, className = "", eyebrow, eyebrowSuffix, headerActions, onClose }: SlideUpSheetProps) {
  const hasSecondary = Boolean(actions?.secondary);
  const hasPrimary = Boolean(actions?.primary);

  return (
    <div className="life-search-period-sheet__backdrop" onClick={onClose} role="presentation">
      <section className={`life-search-period-sheet ${className}`.trim()} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="slide-up-sheet-title">
        <div className="life-search-period-sheet__head">
          <div className="life-search-period-sheet__title">
            <p className="eyebrow life-slide-sheet__eyebrow" id="slide-up-sheet-title">
              <span>{eyebrow}</span>
              {eyebrowSuffix ? <span className="life-slide-sheet__count">{eyebrowSuffix}</span> : null}
            </p>
          </div>
          <div className="life-search-period-sheet__head-actions">
            {headerActions}
            <IconButton label="닫기" onClick={onClose} size="sm" tone="outline">
              <X aria-hidden size={16} />
            </IconButton>
          </div>
        </div>

        <div className="life-slide-sheet__body">{children}</div>

        {hasPrimary || hasSecondary ? (
          <div className={`life-search-period-sheet__actions ${hasSecondary ? "" : "life-search-period-sheet__actions--solo"}`.trim()}>
            {hasSecondary ? (
              <button className="life-search-period-sheet__icon-button" onClick={actions?.secondary?.onClick} type="button" aria-label={actions?.secondary?.label}>
                {actions?.secondary?.icon ?? <Plus aria-hidden size={15} />}
              </button>
            ) : (
              <span aria-hidden className="life-search-period-sheet__actions-spacer" />
            )}
            {hasPrimary ? (
              <button className="life-search-period-sheet__done life-search-period-sheet__done--small" onClick={actions?.primary?.onClick} type="button">
                {actions?.primary?.icon ?? <Plus aria-hidden size={15} />}
                <span>{actions?.primary?.label}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
