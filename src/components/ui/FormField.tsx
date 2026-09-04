import type { ReactNode } from "react";

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  label: string;
};

export function FormField({ children, className = "", label }: FormFieldProps) {
  return (
    <div className={`ui-form-field ${className}`.trim()}>
      <span className="ui-form-field__label">{label}</span>
      {children}
    </div>
  );
}

