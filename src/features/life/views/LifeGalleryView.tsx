"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatFullDate } from "@/features/life/dateTime";
import { formatGeoMetadata, formatStoredMediaMetaLines, getMediaFigureStyle, hasGeoMetadata } from "@/features/life/media";
import { getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import type { LifePhotoRecord } from "@/types/domain";

const PAGE_SIZE = 24;

export function LifeGalleryView({
  onDeletePhoto,
  photos,
}: {
  onDeletePhoto: (photo: LifePhotoRecord) => Promise<void> | void;
  photos: LifePhotoRecord[];
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
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
    setDeletingPhotoId(photo.id);
    setMessage("");
    setError(null);
    try {
      await onDeletePhoto(photo);
      setMessage("미디어를 삭제했어요.");
    } catch (nextError) {
      console.error("Failed to delete gallery media", nextError);
      setError(getLifeActionErrorMessage(nextError, "미디어를 삭제하지 못했습니다."));
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const resetPeriod = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="갤러리" description="전체 사진과 영상을 시간순으로 모아 보고, 기간 필터와 페이지 단위로 탐색할 수 있게 정리했어요." />
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

          <div className="life-gallery-toolbar__filters">
            <label className="life-capture-date">
              <span>시작일</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="life-capture-date">
              <span>종료일</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <button className="life-capture-secondary" onClick={resetPeriod} type="button">전체 보기</button>
          </div>

          <div className="life-gallery-toolbar__summary">
            <span>
              {startDate || endDate
                ? `${startDate || "처음"} ~ ${endDate || "현재"}`
                : "전체 기간"}
            </span>
            <strong>{currentPage} / {totalPages} 페이지</strong>
          </div>

          {error ? <p className="life-photo-upload-error">{error}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
        </SectionCard>

        <SectionCard className="life-gallery-panel ui-workspace-panel ui-workspace-panel--tall">
          <div className="life-gallery-pagination">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">
              <ChevronLeft aria-hidden size={16} />
              이전
            </button>
            <span>{(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredPhotos.length || 0)}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} type="button">
              다음
              <ChevronRight aria-hidden size={16} />
            </button>
          </div>

          {pagedPhotos.length > 0 ? (
            <div className="life-gallery-grid">
              {pagedPhotos.map((photo) => (
                <figure className="life-gallery-card" key={photo.id} style={getMediaFigureStyle(photo)}>
                  <div className="life-photo-media-frame" style={getMediaFigureStyle(photo)}>
                    {photo.fileUrl ? (
                      photo.mimeType?.startsWith("video/") ? (
                        <video controls src={photo.fileUrl} />
                      ) : (
                        <Image alt={photo.caption || photo.fileName} height={photo.height ?? 360} src={photo.fileUrl} unoptimized width={photo.width ?? 360} />
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
                    <div className="life-photo-meta-lines">{renderStoredMeta(photo)}</div>
                    <button disabled={deletingPhotoId === photo.id} onClick={() => void deletePhoto(photo)} type="button">
                      {deletingPhotoId === photo.id ? "삭제 중..." : "삭제"}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <Camera aria-hidden size={28} />
              <strong>조건에 맞는 사진이나 영상이 없어요.</strong>
              <p>기간을 넓히거나 활동 기록 탭에서 미디어를 먼저 업로드해보세요.</p>
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
