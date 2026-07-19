"use client";

import Image from "next/image";
import { CalendarDays, ChevronLeft, ChevronRight, ImagePlus, MapPin, NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import { CalendarView, ExternalCalendarItem, SelectedDatePlacesMap } from "@/features/calendar/CalendarView";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { LedgerView } from "@/features/ledger/LedgerView";
import { createDailyLogInDb, fetchDailyLogsFromDb, fetchLifePhotosFromDb, uploadLifePhotosToDb } from "@/features/life/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, ExpenseRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeViewMode = "calendar" | "map";

type LifeViewProps = {
  mode: LifeViewMode;
};

type LifeCalendarTab = "events" | "places" | "ledger" | "logs" | "photos";

type PlaceTimelineItem = {
  date: string;
  id: string;
  kind: "schedule" | "task" | "event";
  meta: string;
  place: PlanPlace;
  title: string;
};

type LifeMediaPreview = LifeMediaUploadInput & {
  id: string;
  name: string;
  objectUrl: string;
  mimeType: string;
  sizeBytes: number;
  lastModified: number;
};

const kindLabels: Record<PlaceTimelineItem["kind"], string> = {
  schedule: "일정",
  task: "할 일",
  event: "이벤트",
};

export function LifeView({ mode }: LifeViewProps) {
  return <div className="life-page">{mode === "calendar" ? <LifeCalendarView /> : <LifeMapView />}</div>;
}

function LifeCalendarView() {
  const [activeTab, setActiveTab] = useState<LifeCalendarTab>("events");
  const [dailyLogs, setDailyLogs] = useState<DailyLogRecord[]>([]);
  const [lifePhotos, setLifePhotos] = useState<LifePhotoRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchDailyLogsFromDb(), fetchLifePhotosFromDb()])
      .then(([logs, photos]) => {
        if (!isMounted) return;
        setDailyLogs(logs ?? []);
        setLifePhotos(photos ?? []);
      })
      .catch((error) => console.error("Failed to load life capture data from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const externalItems = useMemo<ExternalCalendarItem[]>(
    () => [
      ...dailyLogs.map((log) => ({
        date: log.date,
        id: log.id,
        meta: log.content.slice(0, 42),
        title: "하루 기록",
        type: "daily_log" as const,
      })),
      ...lifePhotos.map((photo) => ({
        date: photo.date,
        id: photo.id,
        meta: photo.caption || photo.fileName,
        title: "사진 기록",
        type: "photo" as const,
      })),
    ],
    [dailyLogs, lifePhotos],
  );

  const createDailyLog = async (date: string, content: string) => {
    const savedLog = await createDailyLogInDb(date, content);
    if (savedLog) setDailyLogs((current) => [savedLog, ...current]);
  };

  const uploadLifePhotos = async (date: string, uploads: LifeMediaUploadInput[], caption?: string) => {
    const savedPhotos = await uploadLifePhotosToDb(date, uploads, caption);
    if (savedPhotos?.length) setLifePhotos((current) => [...savedPhotos, ...current]);
  };

  return (
    <div className="life-axis-view">
      <div className="life-calendar-switch" aria-label="라이프 캘린더 보기 전환">
        <button
          className={activeTab === "events" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("events")}
          type="button"
        >
          사건
        </button>
        <button
          className={activeTab === "places" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("places")}
          type="button"
        >
          장소
        </button>
        <button
          className={activeTab === "ledger" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("ledger")}
          type="button"
        >
          가계부
        </button>
        <button
          className={activeTab === "logs" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("logs")}
          type="button"
        >
          하루기록
        </button>
        <button
          className={activeTab === "photos" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("photos")}
          type="button"
        >
          사진
        </button>
      </div>

      {activeTab === "events" ? (
        <CalendarView
          allowedTypes={["schedule", "event", "todo"]}
          defaultSelectedDate={formatDateKey(new Date())}
          description="일정과 할 일을 날짜별로 묶고, 필요한 항목을 바로 추가하세요."
          externalItems={externalItems}
          headerVariant="tab"
          keepDateSelected
          showEventAddButton
          showSelectedDatePlacesMap={false}
          title="사건"
        />
      ) : activeTab === "places" ? (
        <LifePlacesView />
      ) : activeTab === "ledger" ? (
        <LedgerView variant="tab" />
      ) : activeTab === "logs" ? (
        <LifeLogsView logs={dailyLogs} onCreateLog={createDailyLog} />
      ) : (
        <LifePhotosView onUploadPhotos={uploadLifePhotos} photos={lifePhotos} />
      )}
    </div>
  );
}

function LifeLogsView({ logs, onCreateLog }: { logs: DailyLogRecord[]; onCreateLog: (date: string, content: string) => Promise<void> | void }) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const selectedLogs = logs.filter((log) => log.date === date);

  const saveLog = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setIsSaving(true);
    try {
      await onCreateLog(date, trimmedContent);
      setContent("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="하루기록" description="짧은 텍스트로 하루의 감정, 생각, 장면을 날짜에 남겨두세요." />
      <div className="life-capture-page">
        <SectionCard className="life-capture-editor">
          <div className="life-capture-card__title">
            <NotebookPen aria-hidden size={17} />
            <span>짧은 하루 기록</span>
          </div>
          <label className="life-capture-date">
            <span>기록 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <textarea placeholder="오늘 기억하고 싶은 것 한두 문장을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
          <button className="life-capture-primary" disabled={!content.trim() || isSaving} onClick={saveLog} type="button">
            {isSaving ? "저장 중" : "기록 저장"}
          </button>
        </SectionCard>

        <SectionCard className="life-capture-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <strong className="life-places-count">{selectedLogs.length}개</strong>
          </div>
          {selectedLogs.length > 0 ? (
            <div className="life-log-list">
              {selectedLogs.map((log) => (
                <article className="life-log-preview" key={log.id}>
                  <span>하루 기록</span>
                  <p>{log.content}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>이날 남긴 기록이 없습니다.</strong>
              <p>왼쪽에서 짧은 하루 기록을 추가하면 이곳에 모입니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LifePhotosView({
  onUploadPhotos,
  photos,
}: {
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string) => Promise<void> | void;
  photos: LifePhotoRecord[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [caption, setCaption] = useState("");
  const [previews, setPreviews] = useState<LifeMediaPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const selectedPhotos = photos.filter((photo) => photo.date === date);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl)), [previews]);

  const selectFiles = async (files: File[]) => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
    setPreviews(await Promise.all(files.map(createLifeMediaPreview)));
  };

  const uploadPhotos = async () => {
    if (previews.length === 0) return;

    setIsUploading(true);
    try {
      await onUploadPhotos(date, previews, caption.trim() || undefined);
      previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
      setPreviews([]);
      setCaption("");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사진" description="사진과 영상을 날짜에 연결해서 하루의 장면을 모아두세요." />
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
          <label className="life-photo-dropzone">
            <input accept="image/*,video/*" multiple type="file" onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))} />
            <ImagePlus aria-hidden size={24} />
            <strong>{previews.length > 0 ? `${previews.length}개 선택됨` : "사진/영상을 선택하세요"}</strong>
            <span>선택한 날짜의 사진 기록으로 저장됩니다.</span>
          </label>
          {previews.length > 0 ? (
            <div className="life-media-preview-grid">
              {previews.map((preview) => (
                <figure key={preview.id}>
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
                    {photo.caption ? <strong>{photo.caption}</strong> : null}
                    <span>{formatStoredMediaMeta(photo)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <ImagePlus aria-hidden size={28} />
              <strong>이날 업로드한 사진이 없습니다.</strong>
              <p>왼쪽에서 사진이나 영상을 선택하면 이곳에서 조회할 수 있습니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

async function createLifeMediaPreview(file: File): Promise<LifeMediaPreview> {
  const objectUrl = URL.createObjectURL(file);
  const basePreview = {
    file,
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    objectUrl,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    lastModified: file.lastModified,
  };

  if (file.type.startsWith("image/")) {
    const dimensions = await readImageDimensions(objectUrl);
    return { ...basePreview, ...dimensions };
  }

  if (file.type.startsWith("video/")) {
    const metadata = await readVideoMetadata(objectUrl);
    return { ...basePreview, ...metadata };
  }

  return basePreview;
}

function readImageDimensions(objectUrl: string) {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = objectUrl;
  });
}

function readVideoMetadata(objectUrl: string) {
  return new Promise<{ width?: number; height?: number; durationSeconds?: number }>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    video.onerror = () => resolve({});
    video.src = objectUrl;
  });
}

function getMediaFigureStyle(media: Pick<LifePhotoRecord, "height" | "width">) {
  return media.width && media.height ? { aspectRatio: `${media.width} / ${media.height}` } : undefined;
}

function formatMediaMeta(media: Pick<LifeMediaPreview, "durationSeconds" | "height" | "lastModified" | "mimeType" | "sizeBytes" | "width">) {
  return [
    media.width && media.height ? `${media.width}×${media.height}` : null,
    media.durationSeconds ? formatDuration(media.durationSeconds) : null,
    media.mimeType,
    formatFileSize(media.sizeBytes),
    new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(media.lastModified)),
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatStoredMediaMeta(media: LifePhotoRecord) {
  return [
    media.width && media.height ? `${media.width}×${media.height}` : null,
    media.durationSeconds ? formatDuration(media.durationSeconds) : null,
    media.mimeType,
    media.sizeBytes ? formatFileSize(media.sizeBytes) : null,
    media.takenAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(media.takenAt)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)}KB`;
  return `${sizeBytes}B`;
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function LifePlacesView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([dbEvents, dbTasks]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
      })
      .catch((error) => console.error("Failed to load life place data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const placesByDate = useMemo(() => {
    const grouped = new Map<string, PlanPlace[]>();
    for (const event of events) {
      if (!event.place) continue;
      for (const date of expandDateRange(event.date, event.endDate)) {
        grouped.set(date, uniquePlanPlaces([...(grouped.get(date) ?? []), event.place]));
      }
    }
    for (const task of tasks) {
      if (!task.place) continue;
      for (const date of expandDateRange(task.scheduledDate, task.dueDate)) {
        grouped.set(date, uniquePlanPlaces([...(grouped.get(date) ?? []), task.place]));
      }
    }
    return grouped;
  }, [events, tasks]);
  const selectedPlaces = placesByDate.get(selectedDate) ?? [];

  const moveMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="장소" description="일정과 할 일에 연결된 장소를 날짜별 동선으로 확인하세요." />

      <div className="life-places-view">
        <SectionCard className="calendar-board life-places-calendar">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <div className="calendar-month-trigger">
              <CalendarDays aria-hidden size={18} />
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </div>
            <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">
              <ChevronRight aria-hidden size={20} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthDays.map((cell) => {
              const places = cell.date ? placesByDate.get(cell.date) ?? [] : [];
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === formatDateKey(new Date());

              return (
                <button
                  className={`calendar-day ${isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? setSelectedDate(cell.date) : undefined)}
                  type="button"
                >
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {places.length > 0 ? (
                      <span className="calendar-day__event-chip" title={`장소 ${places.length}곳`}>
                        <span className="calendar-dot calendar-dot--event" />
                        <span className="calendar-day__event-count">{places.length}</span>
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard className="date-detail-card life-places-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">이날 간 장소</p>
              <h2>{formatFullDate(selectedDate)}</h2>
            </div>
            <strong className="life-places-count">{selectedPlaces.length}곳</strong>
          </div>

          <SelectedDatePlacesMap places={selectedPlaces} />

          {selectedPlaces.length > 0 ? (
            <div className="life-place-card__items">
              {selectedPlaces.map((place) => (
                <article className="life-place-event" key={`${place.providerPlaceId ?? place.name}-${place.latitude}-${place.longitude}`}>
                  <span>장소</span>
                  <div>
                    <strong>{place.name}</strong>
                    <p>{place.address || place.category || "주소 정보 없음"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <MapPin aria-hidden size={28} />
              <strong>{isLoading ? "장소를 불러오는 중입니다." : "이날 연결된 장소가 없습니다."}</strong>
              <p>사건 탭에서 일정이나 할 일에 장소를 추가하면 이곳에 날짜별 장소가 모입니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LifeTabHeading({ description, title }: { description: string; title: string }) {
  return (
    <header className="life-tab-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function LifeMapView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb(), fetchExpenseRecordsFromDb(), fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()])
      .then(([dbEvents, dbTasks, dbExpenses, dbWeights, dbWorkouts]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
        setExpenses(dbExpenses ?? []);
        setWeights(dbWeights ?? []);
        setWorkouts(dbWorkouts ?? []);
      })
      .catch((error) => console.error("Failed to load life map data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const timelineItems = useMemo(() => buildPlaceTimeline(events, tasks), [events, tasks]);
  const groups = useMemo(() => groupTimelineByPlace(timelineItems), [timelineItems]);
  const unlinkedCount = expenses.length + weights.length + workouts.length;

  return (
    <div className="life-map-view">
      <section className="life-map-hero">
        <div>
          <MapPin aria-hidden size={22} />
          <h2>장소축 라이프</h2>
          <p>장소가 연결된 일정과 할 일을 모아서 어디에서 무엇이 있었는지 확인합니다.</p>
        </div>
      </section>

      <section className="life-map-coverage" aria-label="장소축 연결 상태">
        <article>
          <span>장소 연결됨</span>
          <strong>{timelineItems.length}건</strong>
          <p>일정, 이벤트, 할 일</p>
        </article>
        <article>
          <span>장소 연결 필요</span>
          <strong>{unlinkedCount}건</strong>
          <p>가계부, 운동, 몸무게</p>
        </article>
      </section>

      {groups.length > 0 ? (
        <div className="life-place-grid">
          {groups.map((group) => (
            <SectionCard className="life-place-card" key={group.key}>
              <div className="life-place-card__head">
                <div>
                  <span>{group.place.address}</span>
                  <h3>{group.place.name}</h3>
                </div>
                <strong>{group.items.length}건</strong>
              </div>

              <div className="life-place-card__items">
                {group.items.slice(0, 6).map((item) => (
                  <article className="life-place-event" key={item.id}>
                    <span>{kindLabels[item.kind]}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.date} · {item.meta}</p>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <SectionCard className="life-map-empty">
          <MapPin aria-hidden size={32} />
          <strong>{isLoading ? "장소 기록을 불러오는 중입니다." : "장소가 연결된 라이프 항목이 없습니다."}</strong>
          <p>일정이나 할 일에 장소를 추가하면 이 화면에서 장소별 타임라인으로 묶어 볼 수 있습니다.</p>
        </SectionCard>
      )}
    </div>
  );
}

function buildPlaceTimeline(events: CalendarEvent[], tasks: TaskItem[]) {
  const eventItems: PlaceTimelineItem[] = events
    .filter((event) => (event.type === "schedule" || event.type === "event") && Boolean(event.place))
    .map((event) => ({
      id: event.id,
      date: event.date,
      kind: event.type === "event" ? "event" : "schedule",
      title: event.title,
      meta: formatTimelineMeta(formatEventTimeRange(event.time, event.endTime, event.isAllDay), event.companions, event.expenseAmount, event.meta),
      place: event.place as PlanPlace,
    }));

  const taskItems: PlaceTimelineItem[] = tasks
    .filter((task) => Boolean(task.place))
    .map((task) => ({
      id: task.id,
      date: task.scheduledDate,
      kind: "task",
      title: task.title,
      meta: formatTimelineMeta(formatEventTimeRange(task.startTime, task.endTime, task.isAllDay), task.companions, task.expenseAmount, task.memo ?? task.status),
      place: task.place as PlanPlace,
    }));

  return [...eventItems, ...taskItems].sort((a, b) => b.date.localeCompare(a.date));
}

function formatEventTimeRange(startTime?: string, endTime?: string, isAllDay = true) {
  if (isAllDay) return "하루종일";
  if (startTime && endTime) return `${startTime}-${endTime}`;
  return startTime;
}

function formatTimelineMeta(timeLabel?: string, companions?: string, expenseAmount?: number, memo?: string) {
  return [timeLabel, companions, expenseAmount !== undefined ? `${new Intl.NumberFormat("ko-KR").format(expenseAmount)}원` : undefined, memo].filter(Boolean).join(" · ");
}

function groupTimelineByPlace(items: PlaceTimelineItem[]) {
  const grouped = new Map<string, { items: PlaceTimelineItem[]; key: string; place: PlanPlace }>();

  for (const item of items) {
    const key = item.place.providerPlaceId ?? `${item.place.latitude}:${item.place.longitude}:${item.place.name}`;
    const current = grouped.get(key);
    if (current) {
      current.items.push(item);
    } else {
      grouped.set(key, { key, place: item.place, items: [item] });
    }
  }

  return [...grouped.values()].sort((a, b) => b.items.length - a.items.length || a.place.name.localeCompare(b.place.name));
}

function getMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const cells: Array<{ date: string | null; day: number | null; key: string }> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push({ date: null, day: null, key: `empty-start-${index}` });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, key: date });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric", month: "long", weekday: "long" }).format(new Date(`${value}T00:00:00`));
}

function expandDateRange(startDate: string, endDate?: string) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate || startDate}T00:00:00`);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [startDate];

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function uniquePlanPlaces(places: PlanPlace[]) {
  const uniquePlaces = new Map<string, PlanPlace>();
  places.forEach((place) => {
    const key = `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude}|${place.longitude}`;
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}
