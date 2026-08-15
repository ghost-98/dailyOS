"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { getPhotoLinkedTargetOptions, getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import { fetchTasksFromDb } from "@/features/tasks/api";
import { confirmAction } from "@/lib/actionGuards";
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
    if (!confirmAction(editingLogId ? "하루 기록 수정을 저장할까요?" : "하루 기록을 저장할까요?")) return;

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

  const editLog = (log: DailyLogRecord) => {
    setDate(log.date);
    setContent(log.content);
    setEditingLogId(log.id);
    setLinkedTargetKey(log.linkedTargetType && log.linkedTargetId ? `${log.linkedTargetType}:${log.linkedTargetId}` : "");
  };

  const deleteLog = async (id: string) => {
    if (!confirmAction("이 하루 기록을 삭제할까요?")) return;
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
      <LifeTabHeading title="하루 기록" description="하루 전체의 감정, 맥락, 짧은 회고를 날짜 중심으로 남겨두는 공간이에요." />
      <div className="life-capture-page ui-workspace-grid ui-workspace-grid--form-detail">
        <SectionCard className="life-capture-editor ui-workspace-panel">
          <div className="life-capture-card__title ui-card-kicker">
            <NotebookPen aria-hidden size={17} />
            <span>오늘의 하루 기록</span>
          </div>
          <div className="ui-form-grid">
            <FormField label="기록 날짜">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </FormField>
            <FormField label="연결할 기록">
              <select value={linkedTargetKey} onChange={(event) => setLinkedTargetKey(event.target.value)}>
                <option value="">날짜에만 연결</option>
                {linkedTargetOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="내용">
              <textarea placeholder="오늘을 기억하고 싶은 문장, 감정, 사건을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
            </FormField>
          </div>
          <div className="ui-form-actions">
            {editingLogId ? (
              <ActionButton
                onClick={() => {
                  setEditingLogId(null);
                  setContent("");
                  setLinkedTargetKey("");
                }}
                variant="secondary"
              >
                수정 취소
              </ActionButton>
            ) : null}
            <ActionButton disabled={!content.trim() || isSaving} onClick={saveLog}>
              {isSaving ? "저장 중..." : editingLogId ? "기록 수정" : "기록 저장"}
            </ActionButton>
          </div>
          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
        </SectionCard>

        <SectionCard className="life-capture-list ui-workspace-panel">
          <div className="section-heading ui-panel-heading ui-panel-heading--compact">
            <div className="ui-panel-heading__intro">
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <div className="ui-panel-heading__meta">
              <strong className="life-places-count">{selectedLogs.length}개</strong>
            </div>
          </div>
          {selectedLogs.length > 0 ? (
            <div className="life-log-list">
              {selectedLogs.map((log) => (
                <article className="life-log-preview" key={log.id}>
                  {log.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(log.linkedTargetType)} · {log.linkedTargetTitle}</b> : null}
                  <span>하루 기록</span>
                  <p>{log.content}</p>
                  <div className="life-record-actions">
                    <IconButton label="기록 수정" onClick={() => editLog(log)} size="sm" tone="soft">
                      <Pencil aria-hidden size={14} />
                    </IconButton>
                    <IconButton disabled={deletingLogId === log.id} label="기록 삭제" onClick={() => void deleteLog(log.id)} size="sm" tone="danger">
                      <Trash2 aria-hidden size={14} />
                    </IconButton>
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
