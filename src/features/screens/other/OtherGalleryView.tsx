"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { PeriodFilterSheet } from "@/components/shared/date/PeriodFilterSheet";
import { PeriodSummaryBar } from "@/components/shared/date/PeriodSummaryBar";
import { SlideUpSheet } from "@/components/shared/sheets/SlideUpSheet";
import { IconButton } from "@/components/ui/IconButton";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { DayPhotoDetail } from "@/features/screens/day/details/photos/DayPhotoDetail";
import { OtherTabShell } from "@/features/screens/other/components/OtherTabShell";
import { toDayPhotoItem } from "@/features/screens/other/utils/photoViewItems";
import type { LifePhotoRecord } from "@/types/domain";

const PHOTOS_PER_PAGE = 12;

export function OtherGalleryView() {
  const { data, isLoading } = useRecordsDataState();
  const [selectedPhoto, setSelectedPhoto] = useState<LifePhotoRecord | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [page, setPage] = useState(1);
  const photos = useMemo(() => data.lifePhotos
    .filter((photo) => (!startDate || photo.date >= startDate) && (!endDate || photo.date <= endDate))
    .sort((left, right) => getPhotoTimestamp(right) - getPhotoTimestamp(left)), [data.lifePhotos, endDate, startDate]);
  const pageCount = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pagedPhotos = photos.slice((currentPage - 1) * PHOTOS_PER_PAGE, currentPage * PHOTOS_PER_PAGE);

  return (
    <OtherTabShell title="사진">
      <PeriodSummaryBar count={photos.length} countUnit="장" endDate={endDate} onOpenPeriod={() => setIsPeriodOpen(true)} startDate={startDate} />
      {photos.length > 0 ? (
        <>
          <div className="other-gallery-grid">
            {pagedPhotos.map((photo) => (
              <button aria-label={`${photo.date} 사진 보기`} key={photo.id} onClick={() => setSelectedPhoto(photo)} type="button">
                {photo.fileUrl ? (
                  photo.mimeType?.startsWith("video/") ? <video muted src={photo.fileUrl} /> : <Image alt={photo.caption || photo.fileName} fill sizes="(max-width: 720px) 25vw, 180px" src={photo.fileUrl} unoptimized />
                ) : <Camera aria-hidden size={24} />}
                <span>{photo.date}</span>
              </button>
            ))}
          </div>
          <div className="other-gallery-pagination">
            <IconButton label="이전 사진 페이지" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} size="sm" tone="soft"><ChevronLeft aria-hidden size={16} /></IconButton>
            <span>{currentPage} / {pageCount}</span>
            <IconButton label="다음 사진 페이지" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} size="sm" tone="soft"><ChevronRight aria-hidden size={16} /></IconButton>
          </div>
        </>
      ) : <div className="life-empty-state">{isLoading ? "사진을 불러오는 중..." : "아직 저장된 사진이 없어요."}</div>}

      <PeriodFilterSheet
        endDate={endDate}
        isOpen={isPeriodOpen}
        onClose={() => setIsPeriodOpen(false)}
        onEndDateChange={(value) => { setEndDate(value); setPage(1); }}
        onReset={() => { setStartDate(""); setEndDate(""); setPage(1); }}
        onStartDateChange={(value) => { setStartDate(value); setPage(1); }}
        startDate={startDate}
      />

      {selectedPhoto ? (
        <SlideUpSheet className="life-day-detail-sheet" eyebrow="사진" eyebrowSuffix="1장" onClose={() => setSelectedPhoto(null)}>
          <DayPhotoDetail isLoading={false} items={[toDayPhotoItem(selectedPhoto)]} />
        </SlideUpSheet>
      ) : null}
    </OtherTabShell>
  );
}

function getPhotoTimestamp(photo: LifePhotoRecord) {
  const timestamp = new Date(photo.takenAt || `${photo.date}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
