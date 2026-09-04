import type { RecordLinkedTarget } from "@/features/records/targets/recordTargets";

export type RecordLinkTargetOption = RecordLinkedTarget & {
  date: string;
};

type RecordLinkTargetFieldProps = {
  date: string;
  onChange: (target: RecordLinkedTarget | undefined) => void;
  options: RecordLinkTargetOption[];
  value?: RecordLinkedTarget;
};

export function RecordLinkTargetField({ date, onChange, options, value }: RecordLinkTargetFieldProps) {
  const dateOptions = options.filter((option) => option.date === date);
  const selectedValue = value ? `${value.type}:${value.id}` : "date";

  return (
    <select
      aria-label="연결 대상"
      value={selectedValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChange(nextValue === "date" ? undefined : dateOptions.find((option) => `${option.type}:${option.id}` === nextValue));
      }}
    >
      <option value="date">날짜 자체에 연결</option>
      {dateOptions.map((option) => (
        <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
          {getTargetTypeLabel(option.type)} · {option.title}
        </option>
      ))}
    </select>
  );
}

function getTargetTypeLabel(type: RecordLinkedTarget["type"]) {
  if (type === "activity") return "활동";
  if (type === "todo") return "할 일";
  return "이벤트";
}
