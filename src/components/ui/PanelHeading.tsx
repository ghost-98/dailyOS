import type { ReactNode } from "react";

type PanelHeadingProps = {
  actions?: ReactNode;
  meta?: ReactNode;
  title: string;
};

export function PanelHeading({ actions, meta, title }: PanelHeadingProps) {
  return (
    <div className="section-heading ui-panel-heading ui-panel-heading--compact ui-tab-panel-heading">
      <div className="ui-tab-panel-heading__title">
        <p className="eyebrow">{title}</p>
        {meta}
      </div>
      {actions ? <div className="ui-tab-panel-heading__actions">{actions}</div> : null}
    </div>
  );
}
