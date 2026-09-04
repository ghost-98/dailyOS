export function FormSectionTitle({ description, title }: { description: string; title: string }) {
  return (
    <div className="planner-form-section-title">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
