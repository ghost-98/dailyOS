"use client";

import { Bell, CalendarDays, Clock3, ListChecks, UsersRound, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { IconButton } from "@/components/ui/IconButton";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { FormSectionTitle } from "@/features/calendar/calendarUiParts";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import { categoryLabels } from "@/features/calendar/presentation";
import type { CalendarCategory } from "@/features/calendar/types";
import { parseOptionalAmount } from "@/features/calendar/utils";
import type { CalendarEvent } from "@/features/calendar/data";
import { PeoplePickerField } from "@/features/people/PeoplePickerField";
import type { PersonRecord, PlanPlace, TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type EventCreateSheetProps = {
  allowedTypes: CalendarCategory[];
  defaultDate: string;
  defaultType: CalendarCategory;
  event: CalendarEvent | null;
  isSaving: boolean;
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onSave: (event: CalendarEvent) => void;
  people: PersonRecord[];
};

type TaskCreateSheetProps = {
  defaultDate: string;
  isSaving: boolean;
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onSave: (task: TaskItem) => void;
  people: PersonRecord[];
  task: TaskItem | null;
};

export function EventCreateSheet({
  allowedTypes,
  defaultDate,
  defaultType,
  event,
  isSaving,
  onClose,
  onCreatePerson,
  onSave,
  people,
}: EventCreateSheetProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(event?.endDate ?? event?.date ?? defaultDate);
  const [time, setTime] = useState(event?.time ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [isDateRange, setIsDateRange] = useState(Boolean(event?.endDate && event.endDate !== event.date));
  const [isAllDay, setIsAllDay] = useState(event ? event.isAllDay ?? !event.time : true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(event?.endTime));
  const [type, setType] = useState<CalendarCategory>(event?.type === "event" ? "event" : defaultType);
  const [meta, setMeta] = useState(event?.meta ?? "");
  const [expenseAmount, setExpenseAmount] = useState(event?.expenseAmount !== undefined ? String(event.expenseAmount) : "");
  const [companions, setCompanions] = useState<string[]>(parseCompanionNames(event?.companions));
  const [place, setPlace] = useState<PlanPlace | undefined>(event?.place);
  const { isMobile } = useResponsiveMode();

  const saveCurrentEvent = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: event?.id ?? `calendar-${Date.now()}`,
      date,
      endDate: isDateRange && endDate && endDate !== date ? endDate : undefined,
      type,
      title: trimmedTitle,
      time: isAllDay ? undefined : time || undefined,
      endTime: !isAllDay && hasEndTime ? endTime || undefined : undefined,
      isAllDay,
      meta: meta.trim() || "메모 없음",
      expenseAmount: parseOptionalAmount(expenseAmount),
      companions: companions.length > 0 ? companions.join(", ") : undefined,
      place,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="event-sheet-title" aria-modal="true" className="event-sheet planner-sheet" role="dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header planner-sheet__header">
          <div>
            <h2 id="event-sheet-title">{event ? "항목 수정" : `${categoryLabels[type]} 추가`}</h2>
            <p>{event ? "등록된 내용을 수정합니다." : "날짜와 종류를 정해 계획에 추가합니다."}</p>
          </div>
          <IconButton label="닫기" onClick={onClose} tone="outline">
            <X aria-hidden size={18} />
          </IconButton>
        </header>

        <div className="event-sheet__body planner-sheet__body">
          <FormSectionTitle title="기본 정보" description="제목과 메모를 먼저 잡아두세요." />
          <div className="event-form-card event-form-card--title planner-form-card planner-form-card--primary">
            <label
              className="planner-field planner-field--wide planner-field--title"
              style={isMobile ? { minHeight: 240, padding: "24px 16px 22px" } : undefined}
            >
              <span>제목</span>
              {isMobile ? (
                <textarea
                  autoFocus
                  placeholder={`${categoryLabels[type]} 제목`}
                  rows={4}
                  style={{
                    minHeight: 132,
                    resize: "none",
                    fontSize: "1.06rem",
                    lineHeight: 1.4,
                    paddingTop: 14,
                    paddingBottom: 14,
                  }}
                  value={title}
                  onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                />
              ) : (
                <input autoFocus placeholder={`${categoryLabels[type]} 제목`} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} />
              )}
            </label>
            <label className="planner-field planner-field--wide">
              <span>메모</span>
              <input placeholder="링크, 준비물, 간단한 설명" value={meta} onChange={(changeEvent) => setMeta(changeEvent.target.value)} />
            </label>
          </div>

          <FormSectionTitle title="장소" description="이날 간 장소 탭과 지도에 함께 연결됩니다." />
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

          <FormSectionTitle title="관계와 지출" description="지출은 가계부에 자동으로 연동됩니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <UsersRound aria-hidden size={18} />
                <span>함께한 사람</span>
              </div>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
            </label>

            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <WalletCards aria-hidden size={18} />
                <span>지출</span>
              </div>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(changeEvent) => setExpenseAmount(changeEvent.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>

          <FormSectionTitle title="날짜" description="기본은 단일 날짜이며, 기간 설정을 켜면 종료 날짜를 함께 기록합니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid planner-date-grid">
            <div className="planner-date-row">
              <label className="event-form-row event-form-row--field planner-field">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>날짜</span>
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(changeEvent) => {
                    setDate(changeEvent.target.value);
                    if (!isDateRange) setEndDate(changeEvent.target.value);
                  }}
                />
              </label>

              {isDateRange ? (
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <CalendarDays aria-hidden size={18} />
                    <span>종료 날짜</span>
                  </div>
                  <input type="date" value={endDate} onChange={(changeEvent) => setEndDate(changeEvent.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>기간</span>
                </div>
                <label className="planner-option-toggle">
                  <input
                    checked={isDateRange}
                    type="checkbox"
                    onChange={(changeEvent) => {
                      setIsDateRange(changeEvent.target.checked);
                      if (!changeEvent.target.checked) setEndDate(date);
                    }}
                  />
                  <span>기간 설정</span>
                </label>
              </label>
            </div>
          </div>

          <FormSectionTitle title="시간" description="기본은 하루종일이며, 체크를 해제하면 시작 시간과 종료 시간을 설정할 수 있습니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid planner-time-grid">
            <div className="planner-time-row">
              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시간</span>
                </div>
                <label className="planner-option-toggle">
                  <input
                    checked={isAllDay}
                    type="checkbox"
                    onChange={(changeEvent) => {
                      setIsAllDay(changeEvent.target.checked);
                      if (changeEvent.target.checked) {
                        setTime("");
                        setEndTime("");
                        setHasEndTime(false);
                      }
                    }}
                  />
                  <span>하루종일</span>
                </label>
              </label>

              <label className="event-form-row event-form-row--field planner-field">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시작 시간</span>
                </div>
                <input disabled={isAllDay} type="time" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} />
              </label>

              {!isAllDay && hasEndTime ? (
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <Clock3 aria-hidden size={18} />
                    <span>종료 시간</span>
                  </div>
                  <input type="time" value={endTime} onChange={(changeEvent) => setEndTime(changeEvent.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>종료</span>
                </div>
                <label className="planner-option-toggle">
                  <input
                    checked={!isAllDay && hasEndTime}
                    disabled={isAllDay}
                    type="checkbox"
                    onChange={(changeEvent) => {
                      setHasEndTime(changeEvent.target.checked);
                      if (!changeEvent.target.checked) setEndTime("");
                    }}
                  />
                  <span>종료시간 설정</span>
                </label>
              </label>
            </div>
          </div>

          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--select planner-field">
              <div className="event-form-row__label">
                <Bell aria-hidden size={18} />
                <span>종류</span>
              </div>
              <select value={type} onChange={(changeEvent) => setType(changeEvent.target.value as CalendarCategory)}>
                {allowedTypes.map((allowedType) => (
                  <option key={allowedType} value={allowedType}>
                    {categoryLabels[allowedType]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {isMobile ? (
          <MobileSheetSubmitButton disabled={isSaving} onClick={saveCurrentEvent}>
            {isSaving ? "저장 중..." : event ? "이벤트 수정" : `${categoryLabels[type]} 추가`}
          </MobileSheetSubmitButton>
        ) : (
          <FormActionBar cancelDisabled={isSaving} onCancel={onClose} onSubmit={saveCurrentEvent} submitDisabled={isSaving} submitLabel={isSaving ? "저장 중..." : "저장"} />
        )}
      </section>
    </div>
  );
}

export function TaskCreateSheet({
  defaultDate,
  isSaving,
  onClose,
  onCreatePerson,
  onSave,
  people,
  task,
}: TaskCreateSheetProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [memo, setMemo] = useState(task?.memo ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [scheduledDate, setScheduledDate] = useState(task?.scheduledDate ?? defaultDate);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? task?.scheduledDate ?? defaultDate);
  const [startTime, setStartTime] = useState(task?.startTime ?? "");
  const [endTime, setEndTime] = useState(task?.endTime ?? "");
  const [isDateRange, setIsDateRange] = useState(Boolean(task?.dueDate && task.dueDate !== task.scheduledDate));
  const [isAllDay, setIsAllDay] = useState(task ? task.isAllDay ?? !task.startTime : true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(task?.endTime));
  const [expenseAmount, setExpenseAmount] = useState(task?.expenseAmount !== undefined ? String(task.expenseAmount) : "");
  const [companions, setCompanions] = useState<string[]>(parseCompanionNames(task?.companions));
  const [place, setPlace] = useState<PlanPlace | undefined>(task?.place);
  const { isMobile } = useResponsiveMode();

  const saveTask = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: task?.id ?? `task-${Date.now()}`,
      title: trimmedTitle,
      status,
      priority,
      scheduledDate,
      dueDate: isDateRange && dueDate && dueDate !== scheduledDate ? dueDate : undefined,
      startTime: isAllDay ? undefined : startTime || undefined,
      endTime: !isAllDay && hasEndTime ? endTime || undefined : undefined,
      isAllDay,
      completedAt: status === "done" ? task?.completedAt ?? new Date().toISOString() : undefined,
      deferredCount: task?.deferredCount ?? 0,
      memo: memo.trim() || undefined,
      expenseAmount: parseOptionalAmount(expenseAmount),
      companions: companions.length > 0 ? companions.join(", ") : undefined,
      place,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="task-sheet-title" aria-modal="true" className="event-sheet planner-sheet task-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header planner-sheet__header">
          <div>
            <h2 id="task-sheet-title">{task ? "할 일 수정" : "할 일 추가"}</h2>
            <p>{task ? "상태와 날짜를 조정합니다." : "예정일 기준으로 할 일을 추가합니다."}</p>
          </div>
          <IconButton label="닫기" onClick={onClose} tone="outline">
            <X aria-hidden size={18} />
          </IconButton>
        </header>

        <div className="event-sheet__body planner-sheet__body">
          <FormSectionTitle title="기본 정보" description="할 일의 핵심 내용과 메모를 적어두세요." />
          <div className="event-form-card event-form-card--title planner-form-card planner-form-card--primary">
            <label
              className="planner-field planner-field--wide planner-field--title"
              style={isMobile ? { minHeight: 240, padding: "24px 16px 22px" } : undefined}
            >
              <span>제목</span>
              {isMobile ? (
                <textarea
                  autoFocus
                  placeholder="할 일 제목"
                  rows={4}
                  style={{
                    minHeight: 132,
                    resize: "none",
                    fontSize: "1.06rem",
                    lineHeight: 1.4,
                    paddingTop: 14,
                    paddingBottom: 14,
                  }}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              ) : (
                <input autoFocus placeholder="할 일 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
              )}
            </label>
            <label className="planner-field planner-field--wide">
              <span>메모</span>
              <input placeholder="필요한 내용을 적어주세요." value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          <FormSectionTitle title="장소" description="장소 탭의 날짜별 동선에 함께 반영됩니다." />
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

          <FormSectionTitle title="관계와 지출" description="금액을 입력하면 가계부에 연결 지출로 기록됩니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <UsersRound aria-hidden size={18} />
                <span>함께한 사람</span>
              </div>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
            </label>

            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <WalletCards aria-hidden size={18} />
                <span>지출</span>
              </div>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>

          <FormSectionTitle title="진행 상태" description="상태와 우선순위로 오늘 할 일을 정리하세요." />
          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--select planner-field">
              <div className="event-form-row__label">
                <ListChecks aria-hidden size={18} />
                <span>상태</span>
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                <option value="todo">할 일</option>
                <option value="inProgress">진행 중</option>
                <option value="done">완료</option>
              </select>
            </label>

            <label className="event-form-row event-form-row--select planner-field">
              <div className="event-form-row__label">
                <Bell aria-hidden size={18} />
                <span>우선순위</span>
              </div>
              <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                <option value="high">높음</option>
                <option value="normal">보통</option>
                <option value="low">낮음</option>
              </select>
            </label>
          </div>

          <FormSectionTitle title="날짜" description="기본은 단일 날짜이며, 기간 설정을 켜면 종료 날짜를 함께 기록합니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid planner-date-grid">
            <div className="planner-date-row">
              <label className="event-form-row event-form-row--field planner-field">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>날짜</span>
                </div>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => {
                    setScheduledDate(event.target.value);
                    if (!isDateRange) setDueDate(event.target.value);
                  }}
                />
              </label>

              {isDateRange ? (
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <CalendarDays aria-hidden size={18} />
                    <span>종료 날짜</span>
                  </div>
                  <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>기간</span>
                </div>
                <label className="planner-option-toggle">
                  <input
                    checked={isDateRange}
                    type="checkbox"
                    onChange={(event) => {
                      setIsDateRange(event.target.checked);
                      if (!event.target.checked) setDueDate(scheduledDate);
                    }}
                  />
                  <span>기간 설정</span>
                </label>
              </label>
            </div>
          </div>

          <FormSectionTitle title="시간" description="기본은 하루종일이며, 체크를 해제하면 시작 시간과 종료 시간을 설정할 수 있습니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid planner-time-grid">
            <div className="planner-time-row">
              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시간</span>
                </div>
                <label className="planner-option-toggle">
                  <input
                    checked={isAllDay}
                    type="checkbox"
                    onChange={(event) => {
                      setIsAllDay(event.target.checked);
                      if (event.target.checked) {
                        setStartTime("");
                        setEndTime("");
                        setHasEndTime(false);
                      }
                    }}
                  />
                  <span>하루종일</span>
                </label>
              </label>

              <label className="event-form-row event-form-row--field planner-field">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시작 시간</span>
                </div>
                <input disabled={isAllDay} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>

              {!isAllDay && hasEndTime ? (
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <Clock3 aria-hidden size={18} />
                    <span>종료 시간</span>
                  </div>
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>종료</span>
                </div>
                <label className="planner-option-toggle">
                  <input
                    checked={!isAllDay && hasEndTime}
                    disabled={isAllDay}
                    type="checkbox"
                    onChange={(event) => {
                      setHasEndTime(event.target.checked);
                      if (!event.target.checked) setEndTime("");
                    }}
                  />
                  <span>종료시간 설정</span>
                </label>
              </label>
            </div>
          </div>
        </div>

        {isMobile ? (
          <MobileSheetSubmitButton disabled={isSaving} onClick={saveTask}>
            {isSaving ? "저장 중..." : task ? "할 일 수정" : "할 일 추가"}
          </MobileSheetSubmitButton>
        ) : (
          <FormActionBar cancelDisabled={isSaving} onCancel={onClose} onSubmit={saveTask} submitDisabled={isSaving} submitLabel={isSaving ? "저장 중..." : "저장"} />
        )}
      </section>
    </div>
  );
}

function parseCompanionNames(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
