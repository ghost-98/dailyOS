type BadgeProps = {
  children: React.ReactNode;
  tone?: "violet" | "green" | "pink" | "amber" | "muted";
};

export function Badge({ children, tone = "muted" }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

