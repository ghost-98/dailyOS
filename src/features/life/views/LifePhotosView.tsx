"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagePlus, MapPin } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatGeoMetadata, formatStoredMediaMetaLines, getMediaFigureStyle, hasGeoMetadata } from "@/features/life/media";
import { getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import type { LifePhotoRecord } from "@/types/domain";

export function LifePhotosView({
  onDeletePhoto,
  photos,
}: {
  onDeletePhoto: (photo: LifePhotoRecord) => Promise<void> | void;
  photos: LifePhotoRecord[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedPhotos = photos.filter((photo) => photo.date === date);

  const deletePhoto = async (photo: LifePhotoRecord) => {
    setDeletingPhotoId(photo.id);
    setMessage("");
    setError(null);
    try {
      await onDeletePhoto(photo);
      setMessage("미디어를 삭제했어요.");
    } catch (nextError) {
      console.error("Failed to delete life photo", nextError);
      setError(getLifeActionErrorMessage(nextError, "미디어를 삭제하지 못했습니다."));
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사진 · 영상" description="이 탭은 업로드가 아니라 날짜별 갤러리로만 사용합니다." />
      <div className="life-capture-page ui-workspace-grid ui-workspace-grid--sidebar">
        <SectionCard className="life-capture-list ui-workspace-panel">
          <div className="section-heading ui-panel-heading ui-panel-heading--compact">
            <div className="ui-panel-heading__intro">
              <p className="eyebrow">갤러리 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <div className="ui-panel-heading__meta">
              <strong className="life-places-count">{selectedPhotos.length}개</strong>
            </div>
          </div>

          <label className="life-capture-date">
            <span>조회 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          {error ? <p className="life-photo-upload-error">{error}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}

          {selectedPhotos.length > 0 ? (
            <div className={getPhotoGalleryClassName(selectedPhotos.length)}>
              {selectedPhotos.map((photo) => (
                <figure key={photo.id} style={getMediaFigureStyle(photo)}>
                  <div className="life-photo-media-frame" style={getMediaFigureStyle(photo)}>
                    {photo.fileUrl ? (
                      photo.mimeType?.startsWith("video/") ? (
                        <video controls src={photo.fileUrl} />
                      ) : (
                        <Image alt={photo.caption || photo.fileName} height={photo.height ?? 420} src={photo.fileUrl} unoptimized width={photo.width ?? 420} />
                      )
                    ) : (
                      <div>{photo.fileName}</div>
                    )}
                  </div>
                  <figcaption>
                    {photo.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(photo.linkedTargetType)} · {photo.linkedTargetTitle}</b> : null}
                    {photo.caption ? <strong>{photo.caption}</strong> : <strong>{photo.fileName}</strong>}
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
              <ImagePlus aria-hidden size={28} />
              <strong>이 날짜에는 남아 있는 사진이나 영상이 없어요.</strong>
              <p>활동 기록 탭의 미디어 업로드에서 올리면 이 갤러리에 바로 모여요.</p>
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

function getPhotoGalleryClassName(photoCount: number) {
  if (photoCount <= 1) return "life-photo-gallery life-photo-gallery--single";
  if (photoCount === 2) return "life-photo-gallery life-photo-gallery--pair";
  return "life-photo-gallery life-photo-gallery--grid";
}
