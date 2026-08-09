"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BedDouble, ChevronLeft, ChevronRight, Clock3, MapPin, MoveRight, NotebookPen, Plus, Sunrise, X } from "lucide-react";
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

type EntryMode = "activity" | "wake" | "sleep";
type SleepDateMode = "selected" | "next";

const BASE_ACTIVITY_CATEGORIES = ["생활", "이동", "업무", "공부", "만남", "운동", "식사", "소비", "수면", "기타"];
const DEFAULT_CATEGORY = "기타";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CUSTOM_CATEGORY_STORAGE_KEY = "dailyos.life.customActivityCategories";

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
  const [entryMode, setEntryMode] = useState<EntryMode>("activity");
  const [date, setDate] = useState(initialDraft?.date ?? formatDateKey(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => createMonthCursor(initialDraft?.date ?? formatDateKey(new Date())));
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [hasTime, setHasTime] = useState(true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(initialDraft?.endTime));
  const [startTime, setStartTime] = useState(initialDraft?.startTime ?? getDefaultActivityTime());
  const [endTime, setEndTime] = useState(initialDraft?.endTime ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [place, setPlace] = useState<PlanPlace | undefined>();
  const [startPlace, setStartPlace] = useState<PlanPlace | undefined>();
  const [endPlace, setEndPlace] = useState<PlanPlace | undefined>();
  const [transportMode, setTransportMode] = useState("");
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
  const [sleepDateMode, setSleepDateMode] = useState<SleepDateMode>("selected");
  const [sleepTime, setSleepTime] = useState("23:30");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepPlace, setSleepPlace] = useState<PlanPlace | undefined>();
  const [wakePlace, setWakePlace] = useState<PlanPlace | undefined>();
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(CUSTOM_CATEGORY_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setCustomCategories(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0));
      }
    } catch (error) {
      console.error("Failed to load custom activity categories", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
  }, [customCategories]);

  useEffect(() => {
    if (!initialDraft) return;
    const draftDate = initialDraft.date ?? formatDateKey(new Date());
    setEditing(null);
    setEntryMode("activity");
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

  const categories = useMemo(
    () => [...BASE_ACTIVITY_CATEGORIES, ...customCategories.filter((item) => !BASE_ACTIVITY_CATEGORIES.includes(item))],
    [customCategories],
  );
  const selectedActivities = useMemo(
    () => activities.filter((activity) => activity.date === date).sort((left, right) => (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99")),
    [activities, date],
  );
  const nextDate = useMemo(() => shiftDateKey(date, 1), [date]);
  const nextDateActivities = useMemo(() => activities.filter((activity) => activity.date === nextDate), [activities, nextDate]);
  const activityCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const activity of activities) counts.set(activity.date, (counts.get(activity.date) ?? 0) + 1);
    return counts;
  }, [activities]);
  const selectedExpenseTotal = selectedActivities.reduce((sum, activity) => sum + (activity.expenseAmount ?? 0), 0);
  const selectedCoveredMinutes = selectedActivities.reduce((sum, activity) => sum + getActivityDurationMinutes(activity), 0);
  const connectedCount = selectedActivities.filter((activity) => hasActivityContext(activity)).length;
  const calendarDays = useMemo(() => getMonthDays(monthCursor.getFullYear(), monthCursor.getMonth()), [monthCursor]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", year: "numeric" }).format(monthCursor);
  const sameDaySleepActivity = useMemo(() => selectedActivities.find((activity) => matchesSleepWakeActivity(activity, "sleep")), [selectedActivities]);
  const nextDaySleepActivity = useMemo(() => nextDateActivities.find((activity) => matchesSleepWakeActivity(activity, "sleep")), [nextDateActivities]);
  const wakeActivity = useMemo(() => selectedActivities.find((activity) => matchesSleepWakeActivity(activity, "wake")), [selectedActivities]);

  useEffect(() => {
    if (entryMode === "sleep") {
      if (sameDaySleepActivity) {
        setSleepDateMode("selected");
        setSleepTime(sameDaySleepActivity.startTime ?? "23:30");
        setSleepPlace(createActivityPlace(sameDaySleepActivity.placeName, sameDaySleepActivity.placeAddress));
      } else if (nextDaySleepActivity) {
        setSleepDateMode("next");
        setSleepTime(nextDaySleepActivity.startTime ?? "00:30");
        setSleepPlace(createActivityPlace(nextDaySleepActivity.placeName, nextDaySleepActivity.placeAddress));
      } else {
        setSleepDateMode("selected");
        setSleepTime("23:30");
        setSleepPlace(undefined);
      }
    }

    if (entryMode === "wake") {
      setWakeTime(wakeActivity?.startTime ?? "07:00");
      setWakePlace(createActivityPlace(wakeActivity?.placeName, wakeActivity?.placeAddress));
    }
  }, [entryMode, nextDaySleepActivity, sameDaySleepActivity, wakeActivity]);

  const resetForm = () => {
    setEditing(null);
    setEntryMode("activity");
    setCategory(DEFAULT_CATEGORY);
    setHasTime(true);
    setHasEndTime(false);
    setStartTime(getDefaultActivityTime());
    setEndTime("");
    setTitle("");
    setPlace(undefined);
    setStartPlace(undefined);
    setEndPlace(undefined);
    setTransportMode("");
    setCompanions([]);
    setFood("");
    setExpenseAmount("");
    setMemo("");
    setFormError("");
  };

  const selectDate = (nextValue: string) => {
    setDate(nextValue);
    setMonthCursor(createMonthCursor(nextValue));
    setEntryMode("activity");
  };

  const editActivity = (activity: LifeActivityRecord) => {
    setEditing(activity);
    setEntryMode("activity");
    selectDate(activity.date);
    setCategory(activity.category ?? DEFAULT_CATEGORY);
    setHasTime(Boolean(activity.startTime));
    setHasEndTime(Boolean(activity.endTime));
    setStartTime(activity.startTime ?? getDefaultActivityTime());
    setEndTime(activity.endTime ?? "");
    setTitle(activity.title);
    setPlace(createActivityPlace(activity.placeName, activity.placeAddress));
    setStartPlace(createActivityPlace(activity.startPlaceName, activity.startPlaceAddress));
    setEndPlace(createActivityPlace(activity.endPlaceName, activity.endPlaceAddress));
    setTransportMode(activity.transportMode ?? "");
    setCompanions(parseCompanionNames(activity.companions));
    setFood(activity.food ?? "");
    setExpenseAmount(activity.expenseAmount ? String(activity.expenseAmount) : "");
    setMemo(activity.memo ?? "");
    setFormError("");
    setMessage("활동 기록을 불러왔어요.");
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
        placeName: category === "이동" ? endPlace?.name : place?.name,
        placeAddress: category === "이동" ? endPlace?.address : place?.address,
        startPlaceName: category === "이동" ? startPlace?.name : undefined,
        startPlaceAddress: category === "이동" ? startPlace?.address : undefined,
        endPlaceName: category === "이동" ? endPlace?.name : undefined,
        endPlaceAddress: category === "이동" ? endPlace?.address : undefined,
        transportMode: category === "이동" ? transportMode.trim() || undefined : undefined,
        companions: companions.length > 0 ? companions.join(", ") : undefined,
        food: category === "식사" ? food.trim() || undefined : undefined,
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

  const saveSleepWake = async (kind: "sleep" | "wake") => {
    if (saveLockRef.current || isSaving) return;

    const isSleep = kind === "sleep";
    const targetDate = isSleep && sleepDateMode === "next" ? nextDate : date;
    const targetActivity = isSleep ? (sleepDateMode === "next" ? nextDaySleepActivity : sameDaySleepActivity) : wakeActivity;
    const targetTime = isSleep ? sleepTime : wakeTime;
    const targetPlace = isSleep ? sleepPlace : wakePlace;
    const label = isSleep ? "취침" : "기상";

    if (!targetTime) {
      setFormError(`${label} 시간은 비워둘 수 없어요.`);
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      await onSaveActivity({
        id: targetActivity?.id ?? `activity-${Date.now()}-${kind}`,
        date: targetDate,
        startTime: targetTime,
        endTime: undefined,
        isAllDay: false,
        title: label,
        category: "수면",
        placeName: targetPlace?.name,
        placeAddress: targetPlace?.address,
        memo: isSleep && sleepDateMode === "next" ? `${date} 하루를 마무리하는 취침` : undefined,
      });
      setMessage(
        isSleep && sleepDateMode === "next"
          ? `${label} 기록을 ${nextDate} 새벽으로 저장했어요.`
          : targetActivity
            ? `${label} 기록을 수정했어요.`
            : `${label} 기록을 저장했어요.`,
      );
      setEntryMode("activity");
    } catch (error) {
      console.error(`Failed to save ${kind} activity`, error);
      setFormError(getLifeActionErrorMessage(error, `${label} 기록을 저장하지 못했습니다.`));
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const addCustomCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (BASE_ACTIVITY_CATEGORIES.includes(trimmed) || customCategories.includes(trimmed)) {
      setNewCategory("");
      return;
    }
    setCustomCategories((current) => [...current, trimmed]);
    setCategory(trimmed);
    setNewCategory("");
    setIsCategoryEditorOpen(false);
  };

  const removeCustomCategory = (target: string) => {
    setCustomCategories((current) => current.filter((item) => item !== target));
    if (category === target) setCategory(DEFAULT_CATEGORY);
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
      <LifeTabHeading title="활동 기록" description="활동을 입력하다가 바로 기상·취침 기록으로 전환할 수 있게 흐름을 정리했어요." />
      <div className={isDayPanelOpen ? "life-activity-layout" : "life-activity-layout life-activity-layout--panel-closed"}>
        <SectionCard className="life-activity-form">
          <div className="section-heading life-activity-form__heading">
            <div>
              <p className="eyebrow">Core Life Block</p>
              <h2>{entryMode === "activity" ? (editing ? "활동 수정" : "활동 추가") : entryMode === "wake" ? "기상 기록" : "취침 기록"}</h2>
            </div>
            <div className="life-record-actions life-activity-form__actions">
              <button disabled={isSaving} onClick={startNow} type="button">지금 시작</button>
              <button disabled={isSaving} onClick={finishRecent} type="button">방금 끝남</button>
              <button className={entryMode === "wake" ? "life-activity-quick-toggle life-activity-quick-toggle--active" : "life-activity-quick-toggle"} disabled={isSaving} onClick={() => setEntryMode("wake")} type="button">기상</button>
              <button className={entryMode === "sleep" ? "life-activity-quick-toggle life-activity-quick-toggle--active" : "life-activity-quick-toggle"} disabled={isSaving} onClick={() => setEntryMode("sleep")} type="button">취침</button>
              {entryMode !== "activity" ? <button disabled={isSaving} onClick={() => setEntryMode("activity")} type="button">활동 입력</button> : null}
              {editing ? <button disabled={isSaving} onClick={resetForm} type="button">새 기록</button> : null}
            </div>
          </div>

          {entryMode === "activity" ? (
            <>
              <div className="life-activity-form-card">
                <label className="life-activity-title-field">
                  <span>활동 내용</span>
                  <input placeholder="예: 점심 미팅, 문서 정리, 집 근처 산책" value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
              </div>

              <div className="life-activity-form-card">
                <div className="schedule-form-section-title life-activity-form-card__title">
                  <strong>활동 유형</strong>
                  <span>기본 태그는 한 번만 보이고, 필요한 경우 직접 추가할 수 있어요.</span>
                </div>
                <div className="life-activity-tag-row">
                  {categories.map((item) => {
                    const isCustom = customCategories.includes(item);
                    return (
                      <div className={category === item ? "life-activity-tag life-activity-tag--active" : "life-activity-tag"} key={item}>
                        <button onClick={() => setCategory(item)} type="button">{item}</button>
                        {isCustom ? (
                          <button aria-label={`${item} 삭제`} className="life-activity-tag__remove" onClick={() => removeCustomCategory(item)} type="button">
                            <X aria-hidden size={12} />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  <button className="life-activity-tag-add" onClick={() => setIsCategoryEditorOpen((current) => !current)} type="button">
                    <Plus aria-hidden size={14} />
                    태그 추가
                  </button>
                </div>
                {isCategoryEditorOpen ? (
                  <div className="life-activity-tag-editor">
                    <input placeholder="새 태그 이름" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
                    <button onClick={addCustomCategory} type="button">추가</button>
                  </div>
                ) : null}
              </div>

              <div className="life-activity-form-card">
                <div className="schedule-form-section-title life-activity-form-card__title">
                  <strong>날짜와 시간</strong>
                  <span>날짜는 오른쪽 달력과 연결되고, 종료 시간은 필요할 때만 붙여요.</span>
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
              </div>

              {category === "이동" ? (
                <div className="life-activity-form-card">
                  <div className="schedule-form-section-title life-activity-form-card__title">
                    <strong>이동 정보</strong>
                    <span>이동은 출발지, 도착지, 이동 수단이 같이 남아야 하루 흐름이 정확해져요.</span>
                  </div>
                  <div className="life-activity-form-grid">
                    <div className="life-activity-form-card life-activity-form-card--inner">
                      <div className="life-activity-minihead">
                        <MapPin aria-hidden size={14} />
                        <span>출발 장소</span>
                      </div>
                      <PlaceSearchField selectedPlace={startPlace} onSelect={setStartPlace} />
                    </div>
                    <div className="life-activity-form-card life-activity-form-card--inner">
                      <div className="life-activity-minihead">
                        <MoveRight aria-hidden size={14} />
                        <span>도착 장소</span>
                      </div>
                      <PlaceSearchField selectedPlace={endPlace} onSelect={setEndPlace} />
                    </div>
                  </div>
                  <label className="event-form-row event-form-row--field schedule-field">
                    <span>이동 수단</span>
                    <input placeholder="예: 도보, 지하철, 버스, 택시, 자차" value={transportMode} onChange={(event) => setTransportMode(event.target.value)} />
                  </label>
                </div>
              ) : (
                <div className="life-activity-form-card">
                  <div className="schedule-form-section-title life-activity-form-card__title">
                    <strong>장소</strong>
                    <span>활동이 실제로 일어난 위치를 기록해요.</span>
                  </div>
                  <PlaceSearchField selectedPlace={place} onSelect={setPlace} />
                </div>
              )}

              <div className="life-activity-form-grid">
                <div className="life-activity-form-card">
                  <div className="schedule-form-section-title life-activity-form-card__title">
                    <strong>함께한 사람</strong>
                    <span>누구와 함께했는지 남겨요.</span>
                  </div>
                  <div className="event-form-row event-form-row--field schedule-field schedule-field--stack">
                    <PeoplePickerField onChange={setCompanions} onCreatePerson={createPerson} people={people} selectedNames={companions} />
                  </div>
                </div>

                <div className="life-activity-form-card">
                  <div className="schedule-form-section-title life-activity-form-card__title">
                    <strong>금액</strong>
                    <span>비용이 생긴 활동이면 금액만 간단히 남겨두세요.</span>
                  </div>
                  <label className="event-form-row event-form-row--field schedule-field">
                    <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
                  </label>
                </div>
              </div>

              {category === "식사" ? (
                <div className="life-activity-form-card">
                  <div className="schedule-form-section-title life-activity-form-card__title">
                    <strong>식사 메모</strong>
                    <span>`식사` 태그일 때만 먹은 내용을 따로 적어요.</span>
                  </div>
                  <label className="event-form-row event-form-row--field schedule-field">
                    <span>먹은 것</span>
                    <input placeholder="예: 샐러드, 라떼, 파스타" value={food} onChange={(event) => setFood(event.target.value)} />
                  </label>
                </div>
              ) : null}

              <div className="life-activity-form-card">
                <div className="schedule-form-section-title life-activity-form-card__title">
                  <strong>메모</strong>
                  <span>짧은 맥락만 적어도 나중에 하루를 복원할 때 크게 도움이 돼요.</span>
                </div>
                <label className="event-form-row event-form-row--field schedule-field">
                  <textarea placeholder="예: 대화가 길어져 예상보다 늦게 끝남" value={memo} onChange={(event) => setMemo(event.target.value)} />
                </label>
              </div>
            </>
          ) : (
            <div className="life-activity-quick-panel life-activity-quick-panel--full">
              <div className="life-activity-quick-panel__head">
                <div>
                  <span className="eyebrow">{entryMode === "wake" ? "Wake Setup" : "Sleep Setup"}</span>
                  <strong>{entryMode === "wake" ? "기상 설정" : "취침 설정"}</strong>
                </div>
                {entryMode === "wake" ? <Sunrise aria-hidden size={18} /> : <BedDouble aria-hidden size={18} />}
              </div>
              {entryMode === "sleep" ? (
                <div className="life-activity-quick-panel__date-mode">
                  <button className={sleepDateMode === "selected" ? "life-activity-date-mode life-activity-date-mode--active" : "life-activity-date-mode"} onClick={() => setSleepDateMode("selected")} type="button">
                    {date} 밤
                  </button>
                  <button className={sleepDateMode === "next" ? "life-activity-date-mode life-activity-date-mode--active" : "life-activity-date-mode"} onClick={() => setSleepDateMode("next")} type="button">
                    {nextDate} 새벽
                  </button>
                  <p>취침이 자정을 넘기면 `다음날 새벽`으로 저장해서 실제 시간 흐름과 달력 날짜를 같이 맞출 수 있어요.</p>
                </div>
              ) : (
                <p className="life-activity-quick-panel__hint">{date}의 하루 시작 기록으로 저장돼요.</p>
              )}
              <div className="life-activity-quick-panel__grid">
                <label className="event-form-row event-form-row--field schedule-field">
                  <span><Clock3 aria-hidden size={14} />시간</span>
                  <input type="time" value={entryMode === "wake" ? wakeTime : sleepTime} onChange={(event) => (entryMode === "wake" ? setWakeTime(event.target.value) : setSleepTime(event.target.value))} />
                </label>
                <div className="life-activity-quick-panel__place">
                  <span><MapPin aria-hidden size={14} />장소</span>
                  <PlaceSearchField selectedPlace={entryMode === "wake" ? wakePlace : sleepPlace} onSelect={entryMode === "wake" ? setWakePlace : setSleepPlace} />
                </div>
              </div>
              <div className="life-activity-quick-panel__actions">
                <button disabled={isSaving} onClick={() => setEntryMode("activity")} type="button">취소</button>
                <button className="life-activity-quick-panel__save" disabled={isSaving} onClick={() => void saveSleepWake(entryMode === "wake" ? "wake" : "sleep")} type="button">
                  {entryMode === "wake" ? "기상 저장" : "취침 저장"}
                </button>
              </div>
            </div>
          )}

          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
          {entryMode === "activity" ? (
            <button className="life-ask-submit" disabled={!title.trim() || isSaving} onClick={() => void saveActivity()} type="button">
              {isSaving ? "저장 중..." : editing ? "활동 수정 저장" : "활동 추가"}
            </button>
          ) : null}
        </SectionCard>

        <SectionCard className={isDayPanelOpen ? "life-activity-list life-selected-day-panel" : "life-activity-list life-selected-day-panel life-selected-day-panel--closed"}>
          <div className="section-heading life-selected-day-panel__heading">
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
                      <p>{formatActivitySummary(activity)}</p>
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

function shiftDateKey(date: string, amount: number) {
  const parsedDate = new Date(`${date}T00:00:00`);
  parsedDate.setDate(parsedDate.getDate() + amount);
  return formatDateKey(parsedDate);
}

function createActivityPlace(name?: string, address?: string): PlanPlace | undefined {
  if (!name) return undefined;
  return {
    address: address ?? "",
    latitude: 0,
    longitude: 0,
    name,
  };
}

function hasActivityContext(activity: LifeActivityRecord) {
  return Boolean(
    activity.placeName ||
      activity.startPlaceName ||
      activity.endPlaceName ||
      activity.transportMode ||
      activity.companions ||
      activity.food ||
      activity.memo ||
      activity.sourceId,
  );
}

function formatActivitySummary(activity: LifeActivityRecord) {
  if (activity.category === "이동") {
    return [
      activity.startPlaceName ? `출발 · ${activity.startPlaceName}` : null,
      activity.endPlaceName ? `도착 · ${activity.endPlaceName}` : null,
      activity.transportMode ? `수단 · ${activity.transportMode}` : null,
      activity.expenseAmount ? formatWon(activity.expenseAmount) : null,
    ].filter(Boolean).join(" · ") || activity.memo || "이동 정보 없음";
  }

  return [
    activity.sourceTitle ? `출처 · ${activity.sourceTitle}` : null,
    activity.placeName,
    activity.companions ? `함께 · ${activity.companions}` : null,
    activity.food ? `식사 · ${activity.food}` : null,
    activity.expenseAmount ? formatWon(activity.expenseAmount) : null,
  ].filter(Boolean).join(" · ") || activity.memo || "연결 정보 없음";
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

function matchesSleepWakeActivity(activity: LifeActivityRecord, kind: "sleep" | "wake") {
  if ((activity.category ?? "").trim() !== "수면") return false;
  return (activity.title ?? "").trim() === (kind === "sleep" ? "취침" : "기상");
}
