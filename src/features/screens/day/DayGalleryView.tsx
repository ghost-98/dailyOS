"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronLeft, ChevronRight, MapPin, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { DayTabHeading } from "@/features/screens/day/DayTabHeading";
import { formatFullDate } from "@/features/life/dateTime";
import { formatGeoMetadata, formatStoredMediaMetaLines, getMediaFigureStyle, hasGeoMetadata } from "@/features/life/media";
import { getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import { getDayActionErrorMessage } from "@/features/screens/day/dayActionErrors";
import { confirmAction } from "@/lib/actionGuards";
import type { LifePhotoRecord } from "@/types/domain";

const PAGE_SIZE = 24;

export function DayGalleryView({
  onDeletePhoto,
  photos,
  showHeading = true,
}: {
  onDeletePhoto: (photo: LifePhotoRecord) => Promise<void> | void;
  photos: LifePhotoRecord[];
  showHeading?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [openInfoIds, setOpenInfoIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");

  const sortedPhotos = useMemo(
    () =>
      [...photos].sort((left, right) => {
        const leftTime = getPhotoSortTime(left);
        const rightTime = getPhotoSortTime(right);
        if (leftTime !== rightTime) return rightTime - leftTime;
        return right.date.localeCompare(left.date);
      }),
    [photos],
  );

  const filteredPhotos = useMemo(
    () =>
      sortedPhotos.filter((photo) => {
        if (startDate && photo.date < startDate) return false;
        if (endDate && photo.date > endDate) return false;
        return true;
      }),
    [endDate, sortedPhotos, startDate],
  );

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [endDate, startDate]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedPhotos = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredPhotos.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredPhotos]);

  const deletePhoto = async (photo: LifePhotoRecord) => {
    const confirmed = confirmAction(`"${photo.caption || photo.fileName}" 항목을 삭제할까요?`);
    if (!confirmed) return;

    setDeletingPhotoId(photo.id);
    setMessage("");
    setError(null);
    try {
      await onDeletePhoto(photo);
      setMessage("미디어를 삭제했어요.");
    } catch (nextError) {
      console.error("Failed to delete gallery media", nextError);
      setError(getDayActionErrorMessage(nextError, "미디어를 삭제하지 못했습니다."));
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const resetPeriod = () => {
    setStartDate("");
    setEndDate("");
  };

  const toggleInfo = (photoId: string) => {
    setOpenInfoIds((current) => (current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]));
  };

  return (
    <div className="life-tab-panel">
      {showHeading ? (
        <DayTabHeading title="갤러리" description="전체 사진과 영상을 시간순으로 모아 보고, 기간 필터와 페이지 단위로 탐색할 수 있게 정리했어요." />
      ) : null}
      <div className="life-gallery-layout ui-workspace-grid ui-workspace-grid--sidebar">
        <SectionCard className="life-gallery-toolbar ui-workspace-panel">
          <div className="section-heading ui-panel-heading ui-panel-heading--compact">
            <div className="ui-panel-heading__intro">
              <p className="eyebrow">기간 필터</p>
              <h2>전체 갤러리</h2>
            </div>
            <div className="ui-panel-heading__meta">
              <strong className="life-places-count">{filteredPhotos.length}개</strong>
            </div>
          </div>

          <div className="life-gallery-toolbar__filters life-gallery-toolbar__filters--compact">
            <FormField label="시작일">
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </FormField>
            <FormField label="종료일">
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </FormField>
            <ActionButton onClick={resetPeriod} variant="secondary">
              전체 보기
            </ActionButton>
          </div>

          <div className="life-gallery-toolbar__summary">
            <span>{startDate || endDate ? `${startDate || "처음"} ~ ${endDate || "현재"}` : "전체 기간"}</span>
            <strong>
              {currentPage} / {totalPages} 페이지
            </strong>
          </div>

          {error ? <p className="life-photo-upload-error">{error}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
        </SectionCard>

        <SectionCard className="life-gallery-panel ui-workspace-panel ui-workspace-panel--tall">
          <div className="life-gallery-pagination">
            <ActionButton disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} variant="secondary">
              <ChevronLeft aria-hidden size={16} />
              이전
            </ActionButton>
            <span>
              {filteredPhotos.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredPhotos.length)}
            </span>
            <ActionButton disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} variant="secondary">
              다음
              <ChevronRight aria-hidden size={16} />
            </ActionButton>
          </div>

          {pagedPhotos.length > 0 ? (
            <div className="life-gallery-grid">
              {pagedPhotos.map((photo) => {
                const isInfoOpen = openInfoIds.includes(photo.id);

                return (
                  <figure className="life-gallery-card" key={photo.id}>
                    <div className="life-gallery-card__media life-photo-media-frame" style={getMediaFigureStyle(photo)}>
                      {photo.fileUrl ? (
                        photo.mimeType?.startsWith("video/") ? (
                          <video controls preload="metadata" src={photo.fileUrl} />
                        ) : (
                          <Image alt={photo.caption || photo.fileName} fill sizes="(max-width: 900px) 100vw, 33vw" src={photo.fileUrl} />
                        )
                      ) : (
                        <div>{photo.fileName}</div>
                      )}
                    </div>

                    <figcaption>
                      <div className="life-gallery-card__head">
                        <div>
                          <span>{formatFullDate(photo.date)}</span>
                          <strong>{photo.caption || photo.fileName}</strong>
                        </div>
                        {photo.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(photo.linkedTargetType)} · {photo.linkedTargetTitle}</b> : null}
                      </div>

                      <div className="life-gallery-card__actions">
                        <ActionButton
                          aria-expanded={isInfoOpen}
                          className={`life-gallery-card__toggle${isInfoOpen ? " life-gallery-card__toggle--open" : ""}`}
                          onClick={() => toggleInfo(photo.id)}
                          variant="secondary"
                        >
                          날짜 · 정보
                          <ChevronDown aria-hidden className="life-gallery-card__chevron" size={15} />
                        </ActionButton>
                        <IconButton disabled={deletingPhotoId === photo.id} label="미디어 삭제" onClick={() => void deletePhoto(photo)} size="sm" tone="danger">
                          <Trash2 aria-hidden size={14} />
                        </IconButton>
                      </div>

                      {isInfoOpen ? <div className="life-photo-meta-lines">{renderStoredMeta(photo)}</div> : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <Camera aria-hidden size={28} />
              <strong>조건에 맞는 사진이나 영상이 없어요.</strong>
              <p>기간을 비우거나 활동 기록 쪽에서 미디어를 먼저 업로드해보세요.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function renderStoredMeta(photo: LifePhotoRecord) {
  const lines = formatStoredMediaMetaLines(photo);
  const gps = formatGeoMetadata(photo);

  return (
    <>
      <span>{formatFullDate(photo.date)}</span>
      {lines.length > 0 ? lines.map((line) => <span key={`${photo.id}-${line}`}>{line}</span>) : <span>표시할 메타데이터가 없어요.</span>}
      {hasGeoMetadata(photo) ? (
        <>
          <b className="life-photo-geo-badge">
            <MapPin aria-hidden size={12} />
            위치 메타데이터 있음
          </b>
          {gps ? <small>{gps}</small> : null}
        </>
      ) : (
        <small>GPS 없음</small>
      )}
    </>
  );
}

function getPhotoSortTime(photo: LifePhotoRecord) {
  const source = photo.takenAt ?? photo.createdAt ?? `${photo.date}T00:00:00`;
  const time = new Date(source).getTime();
  return Number.isFinite(time) ? time : new Date(`${photo.date}T00:00:00`).getTime();
}
