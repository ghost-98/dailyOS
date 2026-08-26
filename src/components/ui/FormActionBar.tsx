import { ActionButton } from "@/components/ui/ActionButton";

type FormActionBarProps = {
  cancelDisabled?: boolean;
  cancelLabel?: string;
  className?: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitLabel: string;
  submitVariant?: "primary" | "secondary" | "danger";
};

export function FormActionBar({
  cancelDisabled = false,
  cancelLabel = "취소",
  className = "",
  onCancel,
  onSubmit,
  submitDisabled = false,
  submitLabel,
  submitVariant = "primary",
}: FormActionBarProps) {
  return (
    <footer className={`ui-form-actions ui-form-actions--footer ${className}`.trim()}>
      <ActionButton disabled={cancelDisabled} onClick={onCancel} variant="secondary">
        {cancelLabel}
      </ActionButton>
      <ActionButton disabled={submitDisabled} onClick={onSubmit} variant={submitVariant}>
        {submitLabel}
      </ActionButton>
    </footer>
  );
}
