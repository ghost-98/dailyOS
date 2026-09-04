import { Camera, ChevronDown } from "lucide-react";

type MapPlaceCardProps = {
  address?: string;
  detailLines: string[];
  index: number;
  isActive: boolean;
  isExpanded: boolean;
  name: string;
  onSelect: () => void;
  onShowPhotos?: () => void;
  photoCount?: number;
  setRef?: (element: HTMLElement | null) => void;
};

export function MapPlaceCard({ address, detailLines, index, isActive, isExpanded, name, onSelect, onShowPhotos, photoCount = 0, setRef }: MapPlaceCardProps) {
  return (
    <article className={`map-place-card ${isActive ? "map-place-card--active" : ""}`} ref={setRef}>
      <button aria-expanded={isExpanded} className="map-place-card__toggle" onClick={onSelect} type="button">
        <span className="life-calendar-route-marker life-calendar-route-marker--inline">{index + 1}</span>
        <strong>{name}</strong>
        <ChevronDown aria-hidden className={`map-place-card__chevron ${isExpanded ? "map-place-card__chevron--open" : ""}`} size={15} />
      </button>
      <div aria-hidden={!isExpanded} className={`map-place-card__details ${isExpanded ? "map-place-card__details--expanded" : ""}`}>
        <div className="map-place-card__photo-rail">
          {photoCount > 0 && onShowPhotos ? (
            <button className="life-calendar-day-photo-badge" onClick={onShowPhotos} type="button"><Camera aria-hidden size={12} />{photoCount}</button>
          ) : null}
        </div>
        <div className="map-place-card__detail-content">
          {address ? <p>{address}</p> : null}
          {detailLines.length > 0 ? <div className="map-place-card__records">{detailLines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}>{line}</span>)}</div> : null}
        </div>
      </div>
    </article>
  );
}
