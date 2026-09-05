import type { HTMLAttributes, ReactNode } from "react";

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function SectionCard({ children, className = "", ...props }: SectionCardProps) {
  return <section className={`section-card ${className}`.trim()} {...props}>{children}</section>;
}

