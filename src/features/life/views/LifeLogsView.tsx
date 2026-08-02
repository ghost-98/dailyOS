"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { getPhotoLinkedTargetOptions, getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { CalendarEvent } from "@/features/calendar/data";
import type { DailyLogRecord, LifeActivityRecord, TaskItem } from "@/types/domain";

export function LifeLogsView({
  activities,
  logs,
  onCreateLog,
  onDeleteLog,
  onUpdateLog,
}: {
  activities: LifeActivityRecord[];
  logs: DailyLogRecord[];
  onCreateLog: (date: string, content: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  onDeleteLog: (id: string) => Promise<void> | void;
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
  const selectedLogs = logs.filter((log) => log.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);

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
      setMessage(editingLogId ? "하루기록을 수정했어요." : "하루기록을 저장했어요.");
    } catch (error) {
      console.error("Failed to save daily log", error);
      setFormError(getLifeActionErrorMessage(error, "하루기록을 저장하지 못했습니다."));
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
      setMessage("하루기록을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete daily log", error);
      setFormError(getLifeActionErrorMessage(error, "하루기록을 삭제하지 못했습니다."));
    } finally {
      setDeletingLogId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="하루기록" description="가능하면 활동에 연결하고, 아직 활동이 없다면 날짜나 계획에 붙여두세요. 리포트와 해당 날짜 타임라인에서 함께 조회됩니다." />
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
          <textarea placeholder="오늘 기억하고 싶은 것 한두 문장을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
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
            {isSaving ? "저장 중" : editingLogId ? "기록 수정" : "기록 저장"}
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
                      {deletingLogId === log.id ? "삭제 중" : "삭제"}
                    </button>
                  </div>
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
