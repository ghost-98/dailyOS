"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { formatDateKey, formatFullDate, parseTimeToMinutes } from "@/features/life/dateTime";
import { getPhotoLinkedTargetOptions, getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import type { LifeLinkedTarget, LifeLinkedTargetOption } from "@/features/life/linkTargets";
import { createLifeMediaPreview, formatMediaMeta, formatStoredMediaMeta, getMediaFigureStyle } from "@/features/life/media";
import type { LifeMediaPreview } from "@/features/life/media";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { getLifePhotoErrorDebugInfo, getLifePhotoUploadErrorMessage } from "@/features/life/views/lifeViewErrors";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { LifeActivityRecord, LifeMediaUploadInput, LifePhotoRecord, TaskItem } from "@/types/domain";

export function LifePhotosView({
  activities,
  onDeletePhoto,
  onUploadPhotos,
  photos,
}: {
  activities: LifeActivityRecord[];
  onDeletePhoto: (photo: LifePhotoRecord) => Promise<void> | void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  photos: LifePhotoRecord[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [caption, setCaption] = useState("");
  const [linkedTargetKey, setLinkedTargetKey] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [previews, setPreviews] = useState<LifeMediaPreview[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selectedPhotos = photos.filter((photo) => photo.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);
  const suggestedTarget = useMemo(
    () => (linkedTargetKey ? null : getSuggestedPhotoTarget(date, previews, activities, events, tasks, linkedTargetOptions)),
    [activities, date, events, linkedTargetKey, linkedTargetOptions, previews, tasks],
  );

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl)), [previews]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([nextEvents, nextTasks]) => {
        if (!isMounted) return;
        setEvents(nextEvents ?? []);
        setTasks(nextTasks ?? []);
      })
      .catch((error) => console.error("Failed to load photo link targets from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const selectFiles = async (files: File[]) => {
    setUploadError(null);
    setMessage("");
    previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
    try {
      setPreviews(await Promise.all(files.map(createLifeMediaPreview)));
    } catch (error) {
      console.error("Failed to prepare life media previews", getLifePhotoErrorDebugInfo(error));
      setPreviews([]);
      setUploadError(getLifePhotoUploadErrorMessage(error));
    }
  };

  const uploadPhotos = async () => {
    if (previews.length === 0) return;

    setIsUploading(true);
    setMessage("");
    try {
      await onUploadPhotos(date, previews, caption.trim() || undefined, linkedTarget ? { id: linkedTarget.id, title: linkedTarget.title, type: linkedTarget.type } : undefined);
      previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
      setPreviews([]);
      setCaption("");
      setLinkedTargetKey("");
      setUploadError(null);
      setMessage("사진/영상을 업로드했어요.");
    } catch (error) {
      console.error("Failed to upload life photos", getLifePhotoErrorDebugInfo(error));
      setUploadError(getLifePhotoUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (photo: LifePhotoRecord) => {
    setDeletingPhotoId(photo.id);
    setMessage("");
    setUploadError(null);
    try {
      await onDeletePhoto(photo);
      setMessage("사진/영상을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete life photo", getLifePhotoErrorDebugInfo(error));
      setUploadError(getLifePhotoUploadErrorMessage(error));
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사진" description="사진과 영상은 활동을 증명하는 기억 조각입니다. 촬영 시간과 기록 시간을 바탕으로 활동/일정/할 일에 연결해 하루 리포트와 검색에서 함께 조회합니다." />
      <div className="life-capture-page">
        <SectionCard className="life-capture-editor">
          <div className="life-capture-card__title">
            <ImagePlus aria-hidden size={17} />
            <span>사진/영상 업로드</span>
          </div>
          <label className="life-capture-date">
            <span>기록 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="life-photo-link-field">
            <span>연결할 활동/계획</span>
            <select value={linkedTargetKey} onChange={(event) => setLinkedTargetKey(event.target.value)}>
              <option value="">날짜에만 연결</option>
              {linkedTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} · {option.title}
                </option>
              ))}
            </select>
          </label>
          {suggestedTarget ? (
            <button className="life-capture-secondary" onClick={() => setLinkedTargetKey(suggestedTarget.key)} type="button">
              추천 연결: {suggestedTarget.label} · {suggestedTarget.title}
            </button>
          ) : null}
          <label className="life-photo-dropzone">
            <input accept="image/*,video/*" multiple type="file" onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))} />
            <ImagePlus aria-hidden size={24} />
            <strong>{previews.length > 0 ? `${previews.length}개 선택됨` : "사진/영상을 선택하세요"}</strong>
            <span>선택한 파일의 크기, 비율, 촬영 추정 시간을 미리 확인합니다.</span>
          </label>
          {previews.length > 0 ? (
            <div className="life-media-preview-grid">
              {previews.map((preview) => (
                <figure key={preview.id} style={getMediaFigureStyle(preview)}>
                  {preview.mimeType.startsWith("video/") ? (
                    <video muted playsInline src={preview.objectUrl} />
                  ) : (
                    <Image alt={preview.name} height={preview.height ?? 180} src={preview.objectUrl} unoptimized width={preview.width ?? 180} />
                  )}
                  <figcaption>
                    <strong>{preview.name}</strong>
                    <span>{formatMediaMeta(preview)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <input className="life-photo-caption-input" placeholder="사진 메모" value={caption} onChange={(event) => setCaption(event.target.value)} />
          {uploadError ? <p className="life-photo-upload-error">{uploadError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
          <button className="life-capture-primary" disabled={previews.length === 0 || isUploading} onClick={uploadPhotos} type="button">
            {isUploading ? "업로드 중" : "업로드"}
          </button>
        </SectionCard>

        <SectionCard className="life-capture-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <strong className="life-places-count">{selectedPhotos.length}개</strong>
          </div>
          {selectedPhotos.length > 0 ? (
            <div className="life-photo-gallery">
              {selectedPhotos.map((photo) => (
                <figure key={photo.id} style={getMediaFigureStyle(photo)}>
                  {photo.fileUrl ? (
                    photo.mimeType?.startsWith("video/") ? (
                      <video controls src={photo.fileUrl} />
                    ) : (
                      <Image alt={photo.caption || photo.fileName} height={photo.height ?? 220} src={photo.fileUrl} unoptimized width={photo.width ?? 220} />
                    )
                  ) : (
                    <div>{photo.fileName}</div>
                  )}
                  <figcaption>
                    {photo.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(photo.linkedTargetType)} · {photo.linkedTargetTitle}</b> : null}
                    {photo.caption ? <strong>{photo.caption}</strong> : null}
                    <span>{formatStoredMediaMeta(photo)}</span>
                    <button disabled={deletingPhotoId === photo.id} onClick={() => void deletePhoto(photo)} type="button">
                      {deletingPhotoId === photo.id ? "삭제 중" : "삭제"}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <ImagePlus aria-hidden size={28} />
              <strong>이 날짜에 업로드한 사진이 없습니다.</strong>
              <p>왼쪽에서 사진이나 영상을 선택하면 이곳에서 조회할 수 있습니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function getSuggestedPhotoTarget(
  date: string,
  previews: LifeMediaPreview[],
  activities: LifeActivityRecord[],
  events: CalendarEvent[],
  tasks: TaskItem[],
  options: LifeLinkedTargetOption[],
) {
  const mediaMinutes = previews
    .map((preview) => {
      const takenAt = new Date(preview.lastModified);
      if (formatDateKey(takenAt) !== date) return undefined;
      return takenAt.getHours() * 60 + takenAt.getMinutes();
    })
    .filter((value): value is number => typeof value === "number");

  if (mediaMinutes.length === 0) return null;

  const candidates = [
    ...activities
      .filter((activity) => activity.date === date)
      .map((activity) => ({ end: parseTimeToMinutes(activity.endTime), key: `activity:${activity.id}`, start: parseTimeToMinutes(activity.startTime) })),
    ...events
      .filter((event) => event.date <= date && (event.endDate ?? event.date) >= date)
      .map((event) => ({ end: parseTimeToMinutes(event.endTime), key: `${event.type}:${event.id}`, start: parseTimeToMinutes(event.time) })),
    ...tasks
      .filter((task) => task.scheduledDate <= date && (task.dueDate ?? task.scheduledDate) >= date)
      .map((task) => ({ end: parseTimeToMinutes(task.endTime), key: `todo:${task.id}`, start: parseTimeToMinutes(task.startTime) })),
  ].filter((candidate) => typeof candidate.start === "number");

  const exactCandidate = candidates.find((candidate) =>
    mediaMinutes.some((minute) => {
      const end = typeof candidate.end === "number" ? candidate.end : candidate.start! + 90;
      return minute >= candidate.start! && minute <= end;
    }),
  );
  if (exactCandidate) return options.find((option) => option.key === exactCandidate.key) ?? null;

  const nearestCandidate = candidates
    .map((candidate) => ({
      ...candidate,
      distance: Math.min(...mediaMinutes.map((minute) => Math.abs(minute - candidate.start!))),
    }))
    .filter((candidate) => candidate.distance <= 120)
    .sort((left, right) => left.distance - right.distance)[0];

  return nearestCandidate ? options.find((option) => option.key === nearestCandidate.key) ?? null : null;
}
