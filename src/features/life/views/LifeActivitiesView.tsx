"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatDateKey, formatFullDate, formatMinutesLabel, getMonthDays, parseTimeToMinutes } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import { formatActivityTime, getActivityDurationMinutes } from "@/features/life/reconstruction";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/people/api";
import { PeoplePickerField } from "@/features/people/PeoplePickerField";
import type { LifeActivityRecord, PersonRecord, PlanPlace } from "@/types/domain";

export type LifeActivityDraft = {
  date?: string;
  endTime?: string;
  title?: string;
  startTime?: string;
};

type ActivityTemplate = {
  category: string;
  title: string;
};

const ACTIVITY_CATEGORIES = ["생활", "이동", "업무", "공부", "만남", "운동", "식사", "소비", "기타"];
const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  { category: "생활", title: "일상 정리" },
  { category: "이동", title: "이동" },
  { category: "업무", title: "업무" },
  { category: "공부", title: "공부" },
  { category: "만남", title: "사람 만남" },
  { category: "운동", title: "운동" },
  { category: "식사", title: "식사" },
];
const DEFAULT_CATEGORY = "기타";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function LifeActivitiesView({
  activities,
  initialDraft,
  onDeleteActivity,
  onSaveActivity,
}: {
  activities: LifeActivityRecord[];
  initialDraft?: LifeActivityDraft;
  onDeleteActivity: (id: string) => Promise<void> | void;
  onSaveActivity: (activity: LifeActivityRecord) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<LifeActivityRecord | null>(null);
  const [date, setDate] = useState(initialDraft?.date ?? formatDateKey(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => createMonthCursor(initialDraft?.date ?? formatDateKey(new Date())));
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [hasTime, setHasTime] = useState(true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(initialDraft?.endTime));
  const [startTime, setStartTime] = useState(initialDraft?.startTime ?? getDefaultActivityTime());
  const [endTime, setEndTime] = useState(initialDraft?.endTime ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [place, setPlace] = useState<PlanPlace | undefined>();
  const [companions, setCompanions] = useState<string[]>([]);
  const [food, setFood] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (!initialDraft) return;
    const draftDate = initialDraft.date ?? formatDateKey(new Date());
    setEditing(null);
    setDate(draftDate);
    setMonthCursor(createMonthCursor(draftDate));
    setHasTime(Boolean(initialDraft.startTime || initialDraft.endTime));
    setHasEndTime(Boolean(initialDraft.endTime));
    setStartTime(initialDraft.startTime ?? getDefaultActivityTime());
    setEndTime(initialDraft.endTime ?? "");
    setTitle(initialDraft.title ?? "");
    setFormError("");
    setMessage("");
  }, [initialDraft]);

  useEffect(() => {
    let isMounted = true;

    fetchPeopleFromDb()
      .then((records) => {
        if (isMounted) setPeople(records ?? []);
      })
      .catch((error) => console.error("Failed to load people list", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedActivities = useMemo(
    () => activities.filter((activity) => activity.date === date).sort((left, right) => (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99")),
    [activities, date],
  );
  const activityCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const activity of activities) counts.set(activity.date, (counts.get(activity.date) ?? 0) + 1);
    return counts;
  }, [activities]);
  const selectedExpenseTotal = selectedActivities.reduce((sum, activity) => sum + (activity.expenseAmount ?? 0), 0);
  const selectedCoveredMinutes = selectedActivities.reduce((sum, activity) => sum + getActivityDurationMinutes(activity), 0);
  const connectedCount = selectedActivities.filter((activity) => activity.placeName || activity.companions || activity.food || activity.memo || activity.sourceId).length;
  const calendarDays = useMemo(() => getMonthDays(monthCursor.getFullYear(), monthCursor.getMonth()), [monthCursor]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", year: "numeric" }).format(monthCursor);

  const resetForm = () => {
    setEditing(null);
    setCategory(DEFAULT_CATEGORY);
    setHasTime(true);
    setHasEndTime(false);
    setStartTime(getDefaultActivityTime());
    setEndTime("");
    setTitle("");
    setPlace(undefined);
    setCompanions([]);
    setFood("");
    setExpenseAmount("");
    setMemo("");
    setFormError("");
  };

  const selectDate = (nextDate: string) => {
    setDate(nextDate);
    setMonthCursor(createMonthCursor(nextDate));
  };

  const editActivity = (activity: LifeActivityRecord) => {
    setEditing(activity);
    selectDate(activity.date);
    setCategory(activity.category ?? DEFAULT_CATEGORY);
    setHasTime(Boolean(activity.startTime));
    setHasEndTime(Boolean(activity.endTime));
    setStartTime(activity.startTime ?? getDefaultActivityTime());
    setEndTime(activity.endTime ?? "");
    setTitle(activity.title);
    setPlace(createActivityPlace(activity));
    setCompanions(parseCompanionNames(activity.companions));
    setFood(activity.food ?? "");
    setExpenseAmount(activity.expenseAmount ? String(activity.expenseAmount) : "");
    setMemo(activity.memo ?? "");
    setFormError("");
    setMessage("활동 기록을 불러왔어요.");
  };

  const applyTemplate = (template: ActivityTemplate) => {
    setCategory(template.category);
    if (!title.trim()) setTitle(template.title);
  };

  const startNow = () => {
    const today = formatDateKey(new Date());
    selectDate(today);
    setHasTime(true);
    setHasEndTime(false);
    setStartTime(getDefaultActivityTime());
    setEndTime("");
    setMessage("지금 시작한 활동 기준으로 시간을 맞췄어요.");
  };

  const finishRecent = () => {
    const endMinutes = parseTimeToMinutes(getDefaultActivityTime()) ?? 0;
    const today = formatDateKey(new Date());
    selectDate(today);
    setHasTime(true);
    setHasEndTime(true);
    setStartTime(formatMinutesLabel(Math.max(0, endMinutes - 60)));
    setEndTime(formatMinutesLabel(endMinutes));
    setMessage("최근 1시간 활동 기준으로 시간을 맞췄어요.");
  };

  const saveActivity = async () => {
    if (saveLockRef.current || isSaving) return;
    if (!title.trim()) return;
    if (hasTime && hasEndTime && startTime && endTime && endTime < startTime) {
      setFormError("종료 시간은 시작 시간보다 뒤여야 합니다.");
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      await onSaveActivity({
        id: editing?.id ?? `activity-${Date.now()}`,
        date,
        startTime: hasTime ? startTime || undefined : undefined,
        endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
        isAllDay: !hasTime,
        title: title.trim(),
        category,
        placeName: place?.name,
        placeAddress: place?.address,
        companions: companions.length > 0 ? companions.join(", ") : undefined,
        food: food.trim() || undefined,
        expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
        memo: memo.trim() || undefined,
        sourceId: editing?.sourceId,
        sourceTitle: editing?.sourceTitle,
        sourceType: editing?.sourceType,
      });
      setMessage(editing ? "활동 기록을 수정했어요." : "활동 기록을 저장했어요.");
      resetForm();
    } catch (error) {
      console.error("Failed to save life activity", error);
      setFormError(getLifeActionErrorMessage(error, "활동 기록을 저장하지 못했습니다."));
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const createPerson = async (name: string) => {
    const savedPerson = await createPersonInDb({ name });
    if (savedPerson) setPeople((current) => [...current, savedPerson].sort((left, right) => left.name.localeCompare(right.name)));
    return savedPerson;
  };

  const deleteActivity = async (activity: LifeActivityRecord) => {
    if (deletingActivityId) return;
    const confirmed = window.confirm(`"${activity.title}" 활동 기록을 삭제할까요? 연결된 지출도 함께 정리됩니다.`);
    if (!confirmed) return;

    setDeletingActivityId(activity.id);
    setFormError("");
    setMessage("");
    try {
      await onDeleteActivity(activity.id);
      if (editing?.id === activity.id) resetForm();
      setMessage("활동 기록을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete life activity", error);
      setFormError(getLifeActionErrorMessage(error, "활동 기록을 삭제하지 못했습니다."));
    } finally {
      setDeletingActivityId(null);
    }
  };

  const moveMonth = (amount: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="활동 기록" description="언제부터 언제까지 어디서 무엇을 했고, 누구와 있었고 무엇을 먹었는지 dailyOS의 핵심 기록으로 남겨요." />
      <div className={isDayPanelOpen ? "life-activity-layout" : "life-activity-layout life-activity-layout--panel-closed"}>
        <SectionCard className="life-activity-form">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Core Life Block</p>
              <h2>{editing ? "활동 수정" : "활동 추가"}</h2>
            </div>
            <div className="life-record-actions">
              <button disabled={isSaving} onClick={startNow} type="button">지금 시작</button>
              <button disabled={isSaving} onClick={finishRecent} type="button">방금 끝남</button>
              {editing ? <button disabled={isSaving} onClick={resetForm} type="button">새 기록</button> : null}
            </div>
          </div>

          <div className="life-activity-quick-grid">
            {ACTIVITY_TEMPLATES.map((template) => (
              <button key={template.category} onClick={() => applyTemplate(template)} type="button">
                {template.category}
              </button>
            ))}
          </div>

          <div className="event-form-card event-form-card--title">
            <label>
              <span>무엇을 했나</span>
              <input placeholder="예: 점심 먹고 대화, 프로젝트 작업" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <div className="schedule-form-section-title">
            <strong>활동 유형</strong>
            <span>나중에 AI가 하루 흐름을 이해할 때 쓰이는 기본 분류예요.</span>
          </div>
          <div className="life-activity-template-grid">
            {ACTIVITY_CATEGORIES.map((item) => (
              <button className={category === item ? "life-activity-template life-activity-template--active" : "life-activity-template"} key={item} onClick={() => setCategory(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          <div className="schedule-form-section-title">
            <strong>날짜와 시간</strong>
            <span>날짜는 오른쪽 달력과 함께 움직이고, 시간은 시작만 있어도 저장할 수 있어요.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-time-grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>기록 날짜</span>
              <input type="date" value={date} onChange={(event) => selectDate(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>시작 시간</span>
              <input disabled={!hasTime} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            {hasEndTime ? (
              <label className="event-form-row event-form-row--field schedule-field">
                <span>종료 시간</span>
                <input disabled={!hasTime} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </label>
            ) : null}
            <div className="event-form-row event-form-row--field schedule-field schedule-toggle-row">
              <span>시간 옵션</span>
              <div className="schedule-option-toggle-group">
                <label className="schedule-option-toggle">
                  <input
                    checked={!hasTime}
                    type="checkbox"
                    onChange={(event) => {
                      setHasTime(!event.target.checked);
                      if (event.target.checked) {
                        setHasEndTime(false);
                        setEndTime("");
                      }
                    }}
                  />
                  시간 미정
                </label>
                <label className="schedule-option-toggle">
                  <input
                    checked={hasEndTime}
                    disabled={!hasTime}
                    type="checkbox"
                    onChange={(event) => {
                      setHasEndTime(event.target.checked);
                      if (!event.target.checked) setEndTime("");
                    }}
                  />
                  종료 시간 사용
                </label>
              </div>
            </div>
          </div>

          <div className="schedule-form-section-title">
            <strong>장소와 함께한 사람</strong>
            <span>일정과 같은 방식으로 장소를 연결하고, 함께한 사람도 바로 묶어둘 수 있어요.</span>
          </div>
          <div className="life-activity-place-stack">
            <PlaceSearchField selectedPlace={place} onSelect={setPlace} />
            <div className="event-form-row event-form-row--field schedule-field schedule-field--stack">
              <span>함께한 사람</span>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={createPerson} people={people} selectedNames={companions} />
            </div>
          </div>

          <div className="schedule-form-section-title">
            <strong>식사, 지출, 메모</strong>
            <span>활동에서 발생한 소비와 맥락을 함께 남겨두면 나중에 복원이 더 쉬워져요.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>먹은 것</span>
              <input placeholder="예: 샐러드, 커피" value={food} onChange={(event) => setFood(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>지출</span>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>메모</span>
              <textarea placeholder="지금의 맥락이나 감정" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
          <button className="life-ask-submit" disabled={!title.trim() || isSaving} onClick={() => void saveActivity()} type="button">
            {isSaving ? "저장 중..." : editing ? "활동 수정 저장" : "활동 추가"}
          </button>
        </SectionCard>

        <SectionCard className={isDayPanelOpen ? "life-activity-list life-selected-day-panel" : "life-activity-list life-selected-day-panel life-selected-day-panel--closed"}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected Day</p>
              <h2>{formatFullDate(date)} 활동 {selectedActivities.length}건</h2>
            </div>
            <button className="life-selected-day-toggle" onClick={() => setIsDayPanelOpen((current) => !current)} type="button">
              {isDayPanelOpen ? "접기" : "열기"}
            </button>
          </div>

          {isDayPanelOpen ? (
            <>
              <div className="life-activity-calendar">
                <div className="life-activity-calendar__header">
                  <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
                    <ChevronLeft aria-hidden size={16} />
                  </button>
                  <strong>{monthLabel}</strong>
                  <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">
                    <ChevronRight aria-hidden size={16} />
                  </button>
                </div>
                <div className="life-activity-calendar__weekdays">
                  {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
                </div>
                <div className="life-activity-calendar__grid">
                  {calendarDays.map((day) => {
                    const count = day.date ? activityCountsByDate.get(day.date) ?? 0 : 0;
                    return (
                      <button
                        aria-pressed={day.date === date}
                        className={day.date === date ? "life-activity-calendar__day life-activity-calendar__day--selected" : "life-activity-calendar__day"}
                        disabled={!day.date}
                        key={day.key}
                        onClick={() => day.date && selectDate(day.date)}
                        type="button"
                      >
                        <span>{day.day}</span>
                        {count > 0 ? <em>{count}</em> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="life-activity-day-summary">
                <article>
                  <span>기록 시간</span>
                  <strong>{selectedCoveredMinutes > 0 ? `${Math.round((selectedCoveredMinutes / 60) * 10) / 10}시간` : "-"}</strong>
                </article>
                <article>
                  <span>활동 지출</span>
                  <strong>{selectedExpenseTotal > 0 ? formatWon(selectedExpenseTotal) : "-"}</strong>
                </article>
                <article>
                  <span>연결 정보</span>
                  <strong>{selectedActivities.length > 0 ? `${connectedCount}/${selectedActivities.length}` : "-"}</strong>
                </article>
              </div>
              {selectedActivities.length > 0 ? (
                selectedActivities.map((activity) => (
                  <article className="life-activity-item" key={activity.id}>
                    <div>
                      <span>{`${formatActivityTime(activity)} · ${activity.category ?? "활동"}`}</span>
                      <strong>{activity.title}</strong>
                      <p>
                        {[
                          activity.sourceTitle ? `출처 · ${activity.sourceTitle}` : null,
                          activity.placeName,
                          activity.companions ? `함께 · ${activity.companions}` : null,
                          activity.food ? `식사 · ${activity.food}` : null,
                          activity.expenseAmount ? formatWon(activity.expenseAmount) : null,
                        ].filter(Boolean).join(" · ") || activity.memo || "연결 정보 없음"}
                      </p>
                    </div>
                    <div className="life-record-actions">
                      <button disabled={isSaving || Boolean(deletingActivityId)} onClick={() => editActivity(activity)} type="button">수정</button>
                      <button disabled={Boolean(deletingActivityId)} onClick={() => void deleteActivity(activity)} type="button">
                        {deletingActivityId === activity.id ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="life-map-empty life-map-empty--compact">
                  <NotebookPen aria-hidden size={28} />
                  <strong>이 날짜에는 활동 기록이 아직 없어요.</strong>
                  <p>오른쪽 달력에서 날짜를 고르거나 왼쪽 입력 폼에서 활동을 하나 추가해보세요.</p>
                </div>
              )}
            </>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

function getDefaultActivityTime() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  return formatMinutesLabel(now.getHours() * 60 + now.getMinutes());
}

function createMonthCursor(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(parsedDate.getTime())) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
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

function getLifeActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function parseCompanionNames(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
