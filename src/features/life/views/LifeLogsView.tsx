"use client";

import { useMemo, useState } from "react";
import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { MobileRecordFrame } from "@/features/life/components/MobileRecordFrame";
import { MobileRecordSheet } from "@/features/life/components/MobileRecordSheet";
import { RecordMonthCalendar } from "@/features/life/components/RecordMonthCalendar";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { createMonthCursor, shiftLifeDateKey } from "@/features/life/activityHelpers";
import { getPhotoLinkedTargetOptions } from "@/features/life/linkTargets";
import { getLinkedTargetTypeLabel } from "@/features/life/formatters";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import { confirmAction } from "@/lib/actionGuards";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import type { CalendarEvent } from "@/features/calendar/data";
import type { DailyLogRecord, LifeActivityRecord, TaskItem } from "@/types/domain";

export function LifeLogsView({
  activities,
  events,
  logs,
  tasks,
  onCreateLog,
  onDeleteLog,
  onUpdateLog,
}: {
  activities: LifeActivityRecord[];
  events: CalendarEvent[];
  logs: DailyLogRecord[];
  tasks: TaskItem[];
  onCreateLog: (date: string, content: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  onDeleteLog: (id: string) => Promise<void> | void;
  onUpdateLog: (log: DailyLogRecord) => Promise<void> | void;
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [content, setContent] = useState("");
  const [linkedTargetKey, setLinkedTargetKey] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => createMonthCursor(formatDateKey(new Date())));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { isMobile, isReady } = useResponsiveMode();
  const selectedLogs = logs.filter((log) => log.date === date);
  const logCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) counts.set(log.date, (counts.get(log.date) ?? 0) + 1);
    return counts;
  }, [logs]);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);

  if (!isReady) {
    return <div className="life-log-view life-log-view--pending" aria-hidden />;
  }

  const formatCreatedAt = (value?: string) => {
    if (!value) return "시간 미상";
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return "시간 미상";
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dateValue);
  };

  const getLinkedTargetLabel = (log: DailyLogRecord) => {
    if (!log.linkedTargetTitle) return "날짜 전체";
    return `${getLinkedTargetTypeLabel(log.linkedTargetType)} · ${log.linkedTargetTitle}`;
  };

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
      setIsComposerOpen(false);
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
    setMonthCursor(createMonthCursor(log.date));
    setContent(log.content);
    setEditingLogId(log.id);
    setLinkedTargetKey(log.linkedTargetType && log.linkedTargetId ? `${log.linkedTargetType}:${log.linkedTargetId}` : "");
    setIsComposerOpen(true);
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

  const openComposer = () => {
    setEditingLogId(null);
    setContent("");
    setLinkedTargetKey("");
    setIsComposerOpen(true);
  };

  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    setMonthCursor(createMonthCursor(nextDate));
  };

  return (
    <div className="life-tab-panel">
      {isMobile ? (
        <>
          <MobileRecordFrame
            addButtonLabel="하루 기록 추가"
            calendar={
              <RecordMonthCalendar
                countsByDate={logCountsByDate}
                monthCursor={monthCursor}
                onNextMonth={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                onPrevMonth={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                onSelectDate={changeDate}
                selectedDate={date}
              />
            }
            dateLabel={formatFullDate(date)}
            countLabel="하루기록"
            countValue={`${selectedLogs.length}건`}
            isCalendarOpen={isCalendarOpen}
            onAddClick={openComposer}
            onNextDate={() => changeDate(shiftLifeDateKey(date, 1))}
            onPrevDate={() => changeDate(shiftLifeDateKey(date, -1))}
            onToggleCalendar={() => setIsCalendarOpen((current) => !current)}
          >
            <div className="life-log-mobile__content">
              {selectedLogs.length > 0 ? (
                <div className="life-log-list">
                  {selectedLogs.map((log) => (
                    <article className="life-log-preview" key={log.id}>
                      <div className="life-log-preview__meta">
                        <span className="life-log-preview__target">{getLinkedTargetLabel(log)}</span>
                        <span className="life-log-preview__time">작성 {formatCreatedAt(log.createdAt)}</span>
                      </div>
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
                  <p>상단의 + 버튼으로 새 기록을 바로 추가할 수 있어요.</p>
                </div>
              )}
            </div>
          </MobileRecordFrame>
          {isComposerOpen ? (
            <MobileRecordSheet
              className="life-capture-editor life-capture-editor--mobile"
              description={formatFullDate(date)}
              onClose={() => {
                setIsComposerOpen(false);
                setEditingLogId(null);
                setContent("");
                setLinkedTargetKey("");
              }}
              title={editingLogId ? "하루 기록 수정" : "오늘의 하루 기록"}
            >
              <div className="ui-form-grid">
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
                <FormField label="내용">
                  <textarea className="life-log-content-textarea" placeholder="오늘을 기억하고 싶은 문장, 감정, 사건을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
                </FormField>
              </div>
              <div className="ui-form-actions">
                {editingLogId ? (
                  <ActionButton
                    onClick={() => {
                      setEditingLogId(null);
                      setContent("");
                      setLinkedTargetKey("");
                      setIsComposerOpen(false);
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
            </MobileRecordSheet>
          ) : null}
        </>
      ) : (
        <div className="life-capture-page ui-workspace-grid ui-workspace-grid--form-detail">
          <SectionCard className="life-capture-editor ui-workspace-panel">
            <div className="life-capture-card__title ui-card-kicker">
              <NotebookPen aria-hidden size={17} />
              <span>오늘의 하루 기록</span>
            </div>
            <div className="ui-form-grid">
              <FormField label="기록 날짜">
                <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
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
              <FormField label="내용">
                <textarea className="life-log-content-textarea" placeholder="오늘을 기억하고 싶은 문장, 감정, 사건을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
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
                    <div className="life-log-preview__meta">
                      <span className="life-log-preview__target">{getLinkedTargetLabel(log)}</span>
                      <span className="life-log-preview__time">작성 {formatCreatedAt(log.createdAt)}</span>
                    </div>
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
      )}
    </div>
  );
}
