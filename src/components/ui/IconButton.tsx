import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  size?: "sm" | "md";
  tone?: "ghost" | "soft" | "outline" | "danger";
};

export function IconButton({
  children,
  className = "",
  label,
  size = "md",
  tone = "soft",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`ui-icon-button ui-icon-button--${tone} ui-icon-button--${size} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
