"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, MapPin } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { formatDateKey, parseTimeToMinutes } from "@/features/life/dateTime";
import { getPhotoLinkedTargetOptions } from "@/features/life/linkTargets";
import type { LifeLinkedTarget, LifeLinkedTargetOption } from "@/features/life/linkTargets";
import {
  createLifeMediaPreview,
  formatGeoMetadata,
  formatMediaMetaLines,
  getMediaFigureStyle,
  hasGeoMetadata,
} from "@/features/life/media";
import type { LifeMediaPreview } from "@/features/life/media";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { LifeActivityRecord, LifeMediaUploadInput, TaskItem } from "@/types/domain";

export function LifeMediaUploadPanel({
  activities,
  date,
  onDateChange,
  onUploadPhotos,
}: {
  activities: LifeActivityRecord[];
  date: string;
  onDateChange: (date: string) => void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
}) {
  const [caption, setCaption] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [linkedTargetKey, setLinkedTargetKey] = useState("");
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState<LifeMediaPreview[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);
  const suggestedTarget = useMemo(
    () => (linkedTargetKey ? null : getSuggestedPhotoTarget(date, previews, activities, events, tasks, linkedTargetOptions)),
    [activities, date, events, linkedTargetKey, linkedTargetOptions, previews, tasks],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([nextEvents, nextTasks]) => {
        if (!isMounted) return;
        setEvents(nextEvents ?? []);
        setTasks(nextTasks ?? []);
      })
      .catch((error) => console.error("Failed to load media link targets from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
    },
    [previews],
  );

  const resetPreviews = () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
    setPreviews([]);
  };

  const selectFiles = async (files: File[]) => {
    setUploadError(null);
    setMessage("");
    resetPreviews();

    try {
      setPreviews(await Promise.all(files.map(createLifeMediaPreview)));
    } catch (error) {
      console.error("Failed to prepare life media previews", error);
      setPreviews([]);
      setUploadError(getLifeActionErrorMessage(error, "사진 또는 영상 미리보기를 준비하지 못했습니다."));
    }
  };

  const clearSelectedMedia = () => {
    resetPreviews();
    setCaption("");
    setLinkedTargetKey("");
    setUploadError(null);
    setMessage("선택한 미디어를 비웠어요.");
  };

  const uploadPhotos = async () => {
    if (previews.length === 0) return;

    setIsUploading(true);
    setMessage("");
    setUploadError(null);
    try {
      await onUploadPhotos(
        date,
        previews,
        caption.trim() || undefined,
        linkedTarget ? { id: linkedTarget.id, title: linkedTarget.title, type: linkedTarget.type } : undefined,
      );
      resetPreviews();
      setCaption("");
      setLinkedTargetKey("");
      setMessage("사진과 영상을 업로드했어요.");
    } catch (error) {
      console.error("Failed to upload life media", error);
      setUploadError(getLifeActionErrorMessage(error, "사진과 영상을 업로드하지 못했습니다."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="life-media-upload-panel">
      <div className="life-capture-card__title ui-card-kicker">
        <ImagePlus aria-hidden size={17} />
        <span>사진 · 영상 업로드</span>
      </div>

      <FormField label="기록 날짜">
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </FormField>

      <FormField label="연결할 기록">
        <select value={linkedTargetKey} onChange={(event) => setLinkedTargetKey(event.target.value)}>
          <option value="">날짜 전체</option>
          {linkedTargetOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} · {option.title}
            </option>
          ))}
        </select>
      </FormField>

      {suggestedTarget ? (
        <ActionButton onClick={() => setLinkedTargetKey(suggestedTarget.key)} variant="secondary">
          추천 연결: {suggestedTarget.label} · {suggestedTarget.title}
        </ActionButton>
      ) : null}

      <label className="life-photo-dropzone">
        <input accept="image/*,video/*" multiple type="file" onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))} />
        <ImagePlus aria-hidden size={24} />
        <strong>{previews.length > 0 ? `${previews.length}개 선택됨` : "사진이나 영상을 선택해 주세요"}</strong>
        <span>업로드 전에 크기, 촬영 시각, 위치 메타데이터를 바로 확인할 수 있어요.</span>
      </label>

      {previews.length > 0 ? (
        <div className="life-media-preview-grid">
          {previews.map((preview) => (
            <figure key={preview.id} style={getMediaFigureStyle(preview)}>
              <div className="life-photo-media-frame" style={getMediaFigureStyle(preview)}>
                {preview.mimeType.startsWith("video/") ? (
                  <video muted playsInline src={preview.objectUrl} />
                ) : (
                  <Image alt={preview.name} height={preview.height ?? 220} src={preview.objectUrl} unoptimized width={preview.width ?? 220} />
                )}
              </div>
              <figcaption>
                <strong>{preview.name}</strong>
                <div className="life-photo-meta-lines">{renderPreviewMeta(preview)}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <input className="life-photo-caption-input" placeholder="사진 메모" value={caption} onChange={(event) => setCaption(event.target.value)} />
      {uploadError ? <p className="life-photo-upload-error">{uploadError}</p> : null}
      {message ? <p className="life-health-message">{message}</p> : null}

      <div className="life-media-upload-panel__actions">
        <ActionButton disabled={previews.length === 0 || isUploading} onClick={clearSelectedMedia} variant="secondary">
          선택 비우기
        </ActionButton>
        <ActionButton disabled={previews.length === 0 || isUploading} onClick={uploadPhotos}>
          {isUploading ? "업로드 중..." : "업로드"}
        </ActionButton>
      </div>
    </div>
  );
}

function renderPreviewMeta(preview: LifeMediaPreview) {
  const lines = formatMediaMetaLines(preview);
  const gps = formatGeoMetadata(preview);

  return (
    <>
      {lines.map((line) => (
        <span key={`${preview.id}-${line}`}>{line}</span>
      ))}
      {hasGeoMetadata(preview) ? (
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
      const takenAt = new Date(preview.takenAt ?? preview.lastModified);
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
