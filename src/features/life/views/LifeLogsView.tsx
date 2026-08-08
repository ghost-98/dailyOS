"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, Clock3, MapPin, NotebookPen, Sunrise } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { getPhotoLinkedTargetOptions, getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, LifeActivityRecord, PlanPlace, TaskItem } from "@/types/domain";

export function LifeLogsView({
  activities,
  logs,
  onCreateLog,
  onDeleteLog,
  onSaveActivity,
  onUpdateLog,
}: {
  activities: LifeActivityRecord[];
  logs: DailyLogRecord[];
  onCreateLog: (date: string, content: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  onDeleteLog: (id: string) => Promise<void> | void;
  onSaveActivity: (activity: LifeActivityRecord) => Promise<void> | void;
  onUpdateLog: (log: DailyLogRecord) => Promise<void> | void;
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [content, setContent] = useState("");
  const [linkedTargetKey, setLinkedTargetKey] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sleepTime, setSleepTime] = useState("23:30");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepPlace, setSleepPlace] = useState<PlanPlace | undefined>();
  const [wakePlace, setWakePlace] = useState<PlanPlace | undefined>();

  const selectedLogs = logs.filter((log) => log.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);
  const selectedActivities = useMemo(() => activities.filter((activity) => activity.date === date), [activities, date]);
  const sleepActivity = useMemo(() => selectedActivities.find((activity) => matchesSleepWakeActivity(activity, "sleep")), [selectedActivities]);
  const wakeActivity = useMemo(() => selectedActivities.find((activity) => matchesSleepWakeActivity(activity, "wake")), [selectedActivities]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([nextEvents, nextTasks]) => {
        if (!isMounted) return;
        setEvents(nextEvents ?? []);
        setTasks(nextTasks ?? []);
      })
      .catch((error) => console.error("Failed to load daily log link targets from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSleepTime(sleepActivity?.startTime ?? "23:30");
    setWakeTime(wakeActivity?.startTime ?? "07:00");
    setSleepPlace(createActivityPlace(sleepActivity));
    setWakePlace(createActivityPlace(wakeActivity));
  }, [sleepActivity, wakeActivity]);

  const saveLog = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      const linkedTargetPayload = linkedTarget ? { id: linkedTarget.id, title: linkedTarget.title, type: linkedTarget.type } : undefined;
      if (editingLogId) {
        await onUpdateLog({
          id: editingLogId,
          date,
          content: trimmedContent,
          linkedTargetId: linkedTargetPayload?.id,
          linkedTargetTitle: linkedTargetPayload?.title,
          linkedTargetType: linkedTargetPayload?.type,
        });
      } else {
        await onCreateLog(date, trimmedContent, linkedTargetPayload);
      }
      setContent("");
      setLinkedTargetKey("");
      setEditingLogId(null);
      setMessage(editingLogId ? "하루 기록을 수정했어요." : "하루 기록을 저장했어요.");
    } catch (error) {
      console.error("Failed to save daily log", error);
      setFormError(getLifeActionErrorMessage(error, "하루 기록을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const saveSleepWake = async (kind: "sleep" | "wake") => {
    const isSleep = kind === "sleep";
    const targetActivity = isSleep ? sleepActivity : wakeActivity;
    const targetTime = isSleep ? sleepTime : wakeTime;
    const targetPlace = isSleep ? sleepPlace : wakePlace;
    const label = isSleep ? "취침" : "기상";

    if (!targetTime) {
      setFormError(`${label} 시간은 비워둘 수 없어요.`);
      return;
    }

    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      await onSaveActivity({
        id: targetActivity?.id ?? `activity-${Date.now()}-${kind}`,
        date,
        startTime: targetTime,
        endTime: undefined,
        isAllDay: false,
        title: label,
        category: "수면",
        placeName: targetPlace?.name,
        placeAddress: targetPlace?.address,
        memo: undefined,
      });
      setMessage(targetActivity ? `${label} 기록을 수정했어요.` : `${label} 기록을 저장했어요.`);
    } catch (error) {
      console.error(`Failed to save ${kind} record`, error);
      setFormError(getLifeActionErrorMessage(error, `${label} 기록을 저장하지 못했습니다.`));
    } finally {
      setIsSaving(false);
    }
  };

  const editLog = (log: DailyLogRecord) => {
    setDate(log.date);
    setContent(log.content);
    setEditingLogId(log.id);
    setLinkedTargetKey(log.linkedTargetType && log.linkedTargetId ? `${log.linkedTargetType}:${log.linkedTargetId}` : "");
  };

  const deleteLog = async (id: string) => {
    setDeletingLogId(id);
    setFormError("");
    setMessage("");
    try {
      await onDeleteLog(id);
      if (editingLogId === id) {
        setEditingLogId(null);
        setContent("");
        setLinkedTargetKey("");
      }
      setMessage("하루 기록을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete daily log", error);
      setFormError(getLifeActionErrorMessage(error, "하루 기록을 삭제하지 못했습니다."));
    } finally {
      setDeletingLogId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="하루 기록" description="하루 전체에 대한 메모를 남기고, 취침·기상처럼 날짜 중심으로 붙는 상태 기록을 함께 관리해요." />
      <div className="life-capture-page">
        <SectionCard className="life-capture-editor">
          <div className="life-capture-card__title">
            <NotebookPen aria-hidden size={17} />
            <span>오늘의 하루 기록</span>
          </div>
          <label className="life-capture-date">
            <span>기록 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <div className="schedule-form-section-title life-capture-section-title">
            <strong>취침 · 기상</strong>
            <span>이 날짜에 잠든 시각과 일어난 시각, 장소를 하루 상태로 남겨요.</span>
          </div>
          <div className="life-sleepwake-grid">
            <article className="life-sleepwake-card">
              <div className="life-sleepwake-card__header">
                <div>
                  <p className="eyebrow">Sleep Check</p>
                  <strong>취침</strong>
                </div>
                <BedDouble aria-hidden size={18} />
              </div>
              <label className="event-form-row event-form-row--field schedule-field">
                <span>
                  <Clock3 aria-hidden size={14} />
                  시간
                </span>
                <input type="time" value={sleepTime} onChange={(event) => setSleepTime(event.target.value)} />
              </label>
              <label className="life-sleepwake-card__field">
                <span>
                  <MapPin aria-hidden size={14} />
                  장소
                </span>
                <PlaceSearchField selectedPlace={sleepPlace} onSelect={setSleepPlace} />
              </label>
              <button className="life-sleepwake-card__submit" disabled={isSaving} onClick={() => void saveSleepWake("sleep")} type="button">
                {sleepActivity ? "취침 수정" : "취침 저장"}
              </button>
            </article>

            <article className="life-sleepwake-card">
              <div className="life-sleepwake-card__header">
                <div>
                  <p className="eyebrow">Wake Check</p>
                  <strong>기상</strong>
                </div>
                <Sunrise aria-hidden size={18} />
              </div>
              <label className="event-form-row event-form-row--field schedule-field">
                <span>
                  <Clock3 aria-hidden size={14} />
                  시간
                </span>
                <input type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} />
              </label>
              <label className="life-sleepwake-card__field">
                <span>
                  <MapPin aria-hidden size={14} />
                  장소
                </span>
                <PlaceSearchField selectedPlace={wakePlace} onSelect={setWakePlace} />
              </label>
              <button className="life-sleepwake-card__submit" disabled={isSaving} onClick={() => void saveSleepWake("wake")} type="button">
                {wakeActivity ? "기상 수정" : "기상 저장"}
              </button>
            </article>
          </div>

          <label className="life-photo-link-field">
            <span>연결할 활동/계획</span>
            <select value={linkedTargetKey} onChange={(event) => setLinkedTargetKey(event.target.value)}>
              <option value="">날짜에만 연결</option>
              {linkedTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <textarea placeholder="오늘을 기억하고 싶은 문장, 감정, 사건을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
          {editingLogId ? (
            <button
              className="life-capture-secondary"
              onClick={() => {
                setEditingLogId(null);
                setContent("");
                setLinkedTargetKey("");
              }}
              type="button"
            >
              수정 취소
            </button>
          ) : null}
          <button className="life-capture-primary" disabled={!content.trim() || isSaving} onClick={saveLog} type="button">
            {isSaving ? "저장 중..." : editingLogId ? "기록 수정" : "기록 저장"}
          </button>
          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
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
                  {log.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(log.linkedTargetType)} · {log.linkedTargetTitle}</b> : null}
                  <span>하루 기록</span>
                  <p>{log.content}</p>
                  <div className="life-record-actions">
                    <button onClick={() => editLog(log)} type="button">
                      수정
                    </button>
                    <button disabled={deletingLogId === log.id} onClick={() => void deleteLog(log.id)} type="button">
                      {deletingLogId === log.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>이 날짜에는 하루 기록이 아직 없어요.</strong>
              <p>왼쪽에서 하루 기록을 남기면 여기에 바로 쌓여요.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function createActivityPlace(activity?: LifeActivityRecord | null): PlanPlace | undefined {
  if (!activity?.placeName) return undefined;
  return {
    address: activity.placeAddress ?? "",
    latitude: 0,
    longitude: 0,
    name: activity.placeName,
  };
}

function matchesSleepWakeActivity(activity: LifeActivityRecord, kind: "sleep" | "wake") {
  if ((activity.category ?? "").trim() !== "수면") return false;
  return (activity.title ?? "").trim() === (kind === "sleep" ? "취침" : "기상");
}
