import { ListFilter, MapPin, Plus, UsersRound, WalletCards } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { formatCurrency } from "@/features/calendar/utils";
import type { PlanPlace } from "@/types/domain";

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

export function PlaceLine({ place }: { place: PlanPlace }) {
  return (
    <p className="date-event__place">
      <MapPin aria-hidden size={14} />
      <span>{place.name}</span>
      {place.address ? <em>{place.address}</em> : null}
    </p>
  );
}

export function PeopleLine({ companions }: { companions: string }) {
  return (
    <p className="date-event__place">
      <UsersRound aria-hidden size={14} />
      <span>{companions}</span>
    </p>
  );
}

export function ExpenseLine({ amount }: { amount: number }) {
  return (
    <p className="date-event__place">
      <WalletCards aria-hidden size={14} />
      <span>{formatCurrency(amount)}</span>
    </p>
  );
}

export function FormSectionTitle({ description, title }: { description: string; title: string }) {
  return (
    <div className="planner-form-section-title">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
