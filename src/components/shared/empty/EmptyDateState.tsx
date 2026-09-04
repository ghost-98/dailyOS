import { ListFilter, Plus } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";

export function EmptyDateState({ isLoading, label, onAdd }: { isLoading: boolean; label: string; onAdd?: () => void }) {
  return (
    <div className="date-empty-state">
      <ListFilter aria-hidden size={24} />
      <strong>{label} 항목이 없습니다.</strong>
      <p>{isLoading ? "불러오는 중입니다." : "상단 추가 버튼으로 새 항목을 등록할 수 있습니다."}</p>
      {!isLoading && onAdd ? (
        <ActionButton className="ui-empty-state__action ui-empty-state__action--primary" onClick={onAdd}>
          <Plus aria-hidden size={15} />
          {label} 추가
        </ActionButton>
      ) : null}
    </div>
  );
}
