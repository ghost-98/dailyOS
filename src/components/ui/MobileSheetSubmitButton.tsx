"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type MobileSheetSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function MobileSheetSubmitButton({ children, className = "", type = "button", ...props }: MobileSheetSubmitButtonProps) {
  return (
    <button className={`life-ask-submit mobile-sheet-submit ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  );
}
