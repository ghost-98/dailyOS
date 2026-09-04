"use client";

import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { SlideUpSheet } from "@/components/shared/sheets/SlideUpSheet";
import { IconButton } from "@/components/ui/IconButton";
import { DayCompanionDetail } from "@/features/screens/day/details/companions/DayCompanionDetail";
import { DayFinanceDetail } from "@/features/screens/day/details/finance/DayFinanceDetail";
import { DayLogDetail } from "@/features/screens/day/details/logs/DayLogDetail";
import { DayMapDetail } from "@/features/screens/day/details/map/DayMapDetail";
import type { DayMapDetailHandle } from "@/features/screens/day/details/map/DayMapDetail";
import { DayPhotoDetail } from "@/features/screens/day/details/photos/DayPhotoDetail";
import type { DayCounterItem, DayDetailView, DayFinanceItem, DayFinanceTotals, DayItemActions, DayLogItem, DayPhotoItem, DayRouteStop } from "@/features/screens/day/dayDetailTypes";

type DayDetailSheetProps = {
  actions?: DayItemActions;
  companionCounts: DayCounterItem[];
  finance: DayFinanceTotals;
  financeItems: DayFinanceItem[];
  financeEntryCount: number;
  isLoading: boolean;
  logItems: DayLogItem[];
  photoTitle: string;
  photoViewerItems: DayPhotoItem[];
  routeStops: DayRouteStop[];
  view: DayDetailView;
  onClose: () => void;
  onOpenPhotos: (items: DayPhotoItem[], title: string) => void;
};

export function DayDetailSheet({ actions, companionCounts, finance, financeItems, financeEntryCount, isLoading, logItems, photoTitle, photoViewerItems, routeStops, view, onClose, onOpenPhotos }: DayDetailSheetProps) {
  const mapRef = useRef<DayMapDetailHandle | null>(null);

  if (!view) return null;

  const detailMeta = getDetailMeta({
    companionCount: companionCounts.length,
    financeEntryCount,
    logCount: logItems.length,
    photoCount: photoViewerItems.length,
    photoTitle,
    routeStopCount: routeStops.length,
    view,
  });

  return (
    <SlideUpSheet
      className="life-day-detail-sheet"
      eyebrow={detailMeta.title}
      eyebrowSuffix={detailMeta.count}
      headerActions={
        view === "map" ? (
          <IconButton label="지도 리셋" onClick={() => mapRef.current?.resetViewport()} size="sm" tone="outline">
            <RotateCcw aria-hidden size={16} />
          </IconButton>
        ) : null
      }
      onClose={onClose}
    >
      {view === "photos" ? <DayPhotoDetail actions={actions} isLoading={isLoading} items={photoViewerItems} /> : null}
      {view === "map" ? <DayMapDetail isLoading={isLoading} onShowPhotos={onOpenPhotos} ref={mapRef} routeStops={routeStops} /> : null}
      {view === "companions" ? <DayCompanionDetail isLoading={isLoading} items={companionCounts} /> : null}
      {view === "finance" ? <DayFinanceDetail actions={actions} finance={finance} items={financeItems} /> : null}
      {view === "logs" ? <DayLogDetail actions={actions} isLoading={isLoading} items={logItems} /> : null}
    </SlideUpSheet>
  );
}

function getDetailMeta({ companionCount, financeEntryCount, logCount, photoCount, photoTitle, routeStopCount, view }: {
  companionCount: number;
  financeEntryCount: number;
  logCount: number;
  photoCount: number;
  photoTitle: string;
  routeStopCount: number;
  view: Exclude<DayDetailView, null>;
}) {
  const meta = {
    photos: { count: `${photoCount}장`, title: photoTitle },
    map: { count: `${routeStopCount}개`, title: "동선 지도" },
    companions: { count: `${companionCount}명`, title: "함께한 사람" },
    finance: { count: `${financeEntryCount}건`, title: "총 수입·지출" },
    logs: { count: `${logCount}건`, title: "하루 기록" },
  } satisfies Record<Exclude<DayDetailView, null>, { count: string; title: string }>;

  return meta[view];
}
