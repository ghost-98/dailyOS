"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BedDouble, ChevronLeft, ChevronRight, Clock3, MapPin, MoveRight, NotebookPen, Plus, Sunrise, X } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { TimelineRail } from "@/components/timeline/TimelineRail";
import { UnifiedTimelineCard } from "@/components/timeline/UnifiedTimelineCard";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import { buildActivityDetailRows, createActivityPlace, createMonthCursor, getDefaultActivityTime, matchesSleepWakeActivity, parseActivityCompanions, shiftLifeDateKey } from "@/features/life/activityHelpers";
import { MobileRecordFrame } from "@/features/life/components/MobileRecordFrame";
import { MobileRecordSheet } from "@/features/life/components/MobileRecordSheet";
import { LifeMediaUploadPanel } from "@/features/life/components/LifeMediaUploadPanel";
import { RecordMonthCalendar } from "@/features/life/components/RecordMonthCalendar";
import { formatDateKey, formatFullDate, getMonthDays } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import { formatActivityTime, getActivityDurationMinutes } from "@/features/life/reconstruction";
import { getLifeActionErrorMessage } from "@/features/life/views/lifeViewErrors";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/people/api";
import { PeoplePickerField } from "@/features/people/PeoplePickerField";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { confirmAction } from "@/lib/actionGuards";
import { Pencil, Trash2 } from "lucide-react";
import type { LifeActivityRecord, LifeMediaUploadInput, PersonRecord, PlanPlace } from "@/types/domain";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";

export type LifeActivityDraft = {
  date?: string;
  endTime?: string;
  title?: string;
  startTime?: string;
};

type EntryMode = "activity" | "wake" | "sleep";
type InputPanelMode = "activity" | "media";
type SleepDateMode = "selected" | "next";

const BASE_ACTIVITY_CATEGORIES = ["생활", "이동", "업무", "공부", "만남", "운동", "식사", "소비", "수면", "기타"];
const DEFAULT_CATEGORY = "기타";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CUSTOM_CATEGORY_STORAGE_KEY = "dailyos.life.customActivityCategories";

export function LifeActivitiesView({
  activities,
  initialDraft,
  onDeleteActivity,
  onUploadPhotos,
  onSaveActivity,
}: {
  activities: LifeActivityRecord[];
  initialDraft?: LifeActivityDraft;
  onDeleteActivity: (id: string) => Promise<void> | void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  onSaveActivity: (activity: LifeActivityRecord) => Promise<void> | void;
}) {
  const { isMobile, isReady } = useResponsiveMode();
  const [editing, setEditing] = useState<LifeActivityRecord | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>("activity");
  const [inputPanelMode, setInputPanelMode] = useState<InputPanelMode>("activity");
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
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sleepDateMode, setSleepDateMode] = useState<SleepDateMode>("selected");
  const [sleepTime, setSleepTime] = useState("23:30");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepPlace, setSleepPlace] = useState<PlanPlace | undefined>();
  const [wakePlace, setWakePlace] = useState<PlanPlace | undefined>();
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);
  const [isComposerOpen, setIsComposerOpen] = useState(Boolean(initialDraft));
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [expandedActivityIds, setExpandedActivityIds] = useState<string[]>([]);
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
    setInputPanelMode("activity");
    setDate(draftDate);
    setMonthCursor(createMonthCursor(draftDate));
    setHasTime(Boolean(initialDraft.startTime || initialDraft.endTime));
    setHasEndTime(Boolean(initialDraft.endTime));
    setStartTime(initialDraft.startTime ?? getDefaultActivityTime());
    setEndTime(initialDraft.endTime ?? "");
    setTitle(initialDraft.title ?? "");
    setFormError("");
    setMessage("");
    setIsComposerOpen(true);
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
  const nextDate = useMemo(() => shiftLifeDateKey(date, 1), [date]);
  const nextDateActivities = useMemo(() => activities.filter((activity) => activity.date === nextDate), [activities, nextDate]);
  const activityCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const activity of activities) counts.set(activity.date, (counts.get(activity.date) ?? 0) + 1);
    return counts;
  }, [activities]);
  const selectedExpenseTotal = selectedActivities.reduce((sum, activity) => sum + (activity.expenseAmount ?? 0), 0);
  const selectedCoveredMinutes = selectedActivities.reduce((sum, activity) => sum + getActivityDurationMinutes(activity), 0);
  const calendarDays = useMemo(() => getMonthDays(monthCursor.getFullYear(), monthCursor.getMonth()), [monthCursor]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", year: "numeric" }).format(monthCursor);
  const availableYears = useMemo(() => {
    const years = [
      new Date().getFullYear(),
      ...activities.map((activity) => Number(activity.date.slice(0, 4))).filter((year) => Number.isFinite(year)),
    ];
    const minYear = Math.min(...years, new Date().getFullYear() - 2);
    const maxYear = Math.max(...years, new Date().getFullYear() + 2);
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [activities]);
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
  useEffect(() => {
    if (editing || entryMode !== "activity" || inputPanelMode === "media") {
      setIsComposerOpen(true);
    }
  }, [editing, entryMode, inputPanelMode]);

  if (!isReady) {
    return <div className="life-activity-view life-activity-view--pending" aria-hidden />;
  }

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
    setInputPanelMode("activity");
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
    setCompanions(parseActivityCompanions(activity.companions));
    setFood(activity.food ?? "");
    setExpenseAmount(activity.expenseAmount ? String(activity.expenseAmount) : "");
    setMemo(activity.memo ?? "");
    setFormError("");
    setMessage("활동 기록을 불러왔어요.");
  };

  const saveActivity = async () => {
    if (saveLockRef.current || isSaving) return;
    if (!title.trim()) return;
    if (hasTime && hasEndTime && startTime && endTime && endTime < startTime) {
      setFormError("종료 시간은 시작 시간보다 뒤여야 합니다.");
      return;
    }
    if (!confirmAction(editing ? "활동 수정을 저장할까요?" : "활동을 저장할까요?")) return;

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
    if (!confirmAction(`${label} 기록을 저장할까요?`)) return;

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
    if (!confirmAction(`"${target}" 태그를 삭제할까요?`)) return;
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
    const confirmed = confirmAction(`"${activity.title}" 활동 기록을 삭제할까요? 연결된 지출도 함께 정리됩니다.`);
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

  const toggleMonthPicker = () => {
    setPickerYear(monthCursor.getFullYear());
    setPickerMonth(monthCursor.getMonth() + 1);
    setIsMonthPickerOpen((current) => !current);
  };

  const applyMonthPicker = () => {
    const targetMonthCursor = new Date(pickerYear, pickerMonth - 1, 1);
    const currentDate = new Date(`${date}T00:00:00`);
    const lastDayOfMonth = new Date(pickerYear, pickerMonth, 0).getDate();
    const nextSelectedDate = new Date(pickerYear, pickerMonth - 1, Math.min(currentDate.getDate(), lastDayOfMonth));
    setMonthCursor(targetMonthCursor);
    setDate(formatDateKey(nextSelectedDate));
    setIsMonthPickerOpen(false);
  };

  const formPanelContent = inputPanelMode === "media" ? (
    <LifeMediaUploadPanel activities={activities} date={date} onDateChange={selectDate} onUploadPhotos={onUploadPhotos} />
  ) : entryMode === "activity" ? (
    <>
      <div className="life-activity-form-card">
        <label className="life-activity-title-field">
          <span>활동 내용</span>
          <input placeholder="예: 점심 미팅, 문서 정리, 집 근처 산책" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
      </div>

      <div className="life-activity-form-card">
        <div className="planner-form-section-title life-activity-form-card__title">
          <strong>활동 유형</strong>
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
        <div className="planner-form-section-title life-activity-form-card__title">
          <strong>날짜와 시간</strong>
        </div>
        <div className="event-form-card planner-form-card planner-form-card--grid planner-time-grid">
          <label className="event-form-row event-form-row--field planner-field">
            <span>기록 날짜</span>
            <input type="date" value={date} onChange={(event) => selectDate(event.target.value)} />
          </label>
          <label className="event-form-row event-form-row--field planner-field">
            <span>시작 시간</span>
            <input disabled={!hasTime} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          {hasEndTime ? (
            <label className="event-form-row event-form-row--field planner-field">
              <span>종료 시간</span>
              <input disabled={!hasTime} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
          ) : null}
          <div className="event-form-row event-form-row--field planner-field planner-toggle-row">
            <span>시간 옵션</span>
            <div className="planner-option-toggle-group">
              <label className="planner-option-toggle">
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
              <label className="planner-option-toggle">
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
          <div className="planner-form-section-title life-activity-form-card__title">
            <strong>이동 정보</strong>
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
          <label className="event-form-row event-form-row--field planner-field">
            <span>이동 수단</span>
            <input placeholder="예: 도보, 지하철, 버스, 택시, 자차" value={transportMode} onChange={(event) => setTransportMode(event.target.value)} />
          </label>
        </div>
      ) : (
        <div className="life-activity-form-card">
          <div className="planner-form-section-title life-activity-form-card__title">
            <strong>장소</strong>
          </div>
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />
        </div>
      )}

      <div className={category === "식사" ? "life-activity-form-grid life-activity-form-grid--people-meal" : "life-activity-form-grid life-activity-form-grid--single-wide"}>
        <div className="life-activity-form-card life-activity-form-card--wide">
          <div className="planner-form-section-title life-activity-form-card__title">
            <strong>함께한 사람</strong>
          </div>
          <div className="event-form-row event-form-row--field planner-field planner-field--stack">
            <PeoplePickerField onChange={setCompanions} onCreatePerson={createPerson} people={people} selectedNames={companions} />
          </div>
        </div>

        {category === "식사" ? (
          <div className="life-activity-form-card">
            <div className="planner-form-section-title life-activity-form-card__title">
              <strong>식사 메모</strong>
            </div>
            <label className="event-form-row event-form-row--field planner-field">
              <input placeholder="예: 샐러드, 라떼, 파스타" value={food} onChange={(event) => setFood(event.target.value)} />
            </label>
          </div>
        ) : null}
      </div>

      <div className="life-activity-form-grid">
        <div className="life-activity-form-card">
          <div className="planner-form-section-title life-activity-form-card__title">
            <strong>금액</strong>
          </div>
          <label className="event-form-row event-form-row--field planner-field">
            <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
          </label>
        </div>

        <div className="life-activity-form-card">
          <div className="planner-form-section-title life-activity-form-card__title">
            <strong>메모</strong>
          </div>
          <label className="event-form-row event-form-row--field planner-field">
            <textarea placeholder="예: 대화가 길어져 예상보다 늦게 끝남" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </label>
        </div>
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
        </div>
      ) : null}
      <div className="life-activity-quick-panel__grid">
        <label className="event-form-row event-form-row--field planner-field">
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
  );

  const formFeedback = (
    <>
      {inputPanelMode === "activity" && formError ? <p className="life-photo-upload-error">{formError}</p> : null}
      {inputPanelMode === "activity" && message ? <p className="life-health-message">{message}</p> : null}
      {inputPanelMode === "activity" && entryMode === "activity" ? (
        <button className="life-ask-submit" disabled={!title.trim() || isSaving} onClick={() => void saveActivity()} type="button">
          {isSaving ? "저장 중..." : editing ? "활동 수정 저장" : "활동 추가"}
        </button>
      ) : null}
    </>
  );

  const inputPanelHeader = (
    <div className="section-heading life-activity-form__heading ui-panel-heading">
      <div className="ui-panel-heading__intro">
        <p className="eyebrow">{inputPanelMode === "activity" ? "활동 입력" : "미디어 업로드"}</p>
        <h2>
          {inputPanelMode === "media"
            ? "사진 · 영상 업로드"
            : entryMode === "activity"
              ? (editing ? "활동 수정" : "활동 추가")
              : entryMode === "wake"
                ? "기상 기록"
                : "취침 기록"}
        </h2>
      </div>
      <div className="life-record-actions life-activity-form__actions ui-panel-heading__actions">
        {inputPanelMode === "activity" ? (
          <div className="life-activity-action-group life-activity-action-group--state">
            <button
              aria-label="기상 기록"
              className={entryMode === "wake" ? "life-activity-state-toggle life-activity-state-toggle--wake life-activity-state-toggle--active" : "life-activity-state-toggle life-activity-state-toggle--wake"}
              disabled={isSaving}
              onClick={() => setEntryMode("wake")}
              type="button"
            >
              <Sunrise aria-hidden size={15} />
            </button>
            <button
              aria-label="취침 기록"
              className={entryMode === "sleep" ? "life-activity-state-toggle life-activity-state-toggle--sleep life-activity-state-toggle--active" : "life-activity-state-toggle life-activity-state-toggle--sleep"}
              disabled={isSaving}
              onClick={() => setEntryMode("sleep")}
              type="button"
            >
              <BedDouble aria-hidden size={15} />
            </button>
            {entryMode !== "activity" ? (
              <button className="life-activity-state-reset" disabled={isSaving} onClick={() => setEntryMode("activity")} type="button">
                활동 입력
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="life-activity-action-group life-activity-action-group--mode">
          <button
            className={inputPanelMode === "activity" ? "life-activity-quick-toggle life-activity-quick-toggle--active" : "life-activity-quick-toggle"}
            disabled={isSaving}
            onClick={() => setInputPanelMode("activity")}
            type="button"
          >
            활동 기록
          </button>
          <button
            className={inputPanelMode === "media" ? "life-activity-quick-toggle life-activity-quick-toggle--active" : "life-activity-quick-toggle"}
            disabled={isSaving}
            onClick={() => setInputPanelMode("media")}
            type="button"
          >
            사진 · 영상
          </button>
        </div>
        {inputPanelMode === "activity" && editing ? <button disabled={isSaving} onClick={resetForm} type="button">새 기록</button> : null}
      </div>
    </div>
  );

  const calendarPanel = (
    <div className="life-activity-calendar">
      <div className="life-activity-calendar__header">
        <IconButton label="이전 달" onClick={() => moveMonth(-1)} size="sm" tone="outline">
          <ChevronLeft aria-hidden size={16} />
        </IconButton>
        <div className="life-activity-calendar__month-picker">
          <button className="life-activity-calendar__month-button" onClick={toggleMonthPicker} type="button">
            {monthLabel}
          </button>
          {isMonthPickerOpen ? (
            <div className="life-activity-calendar__month-popover">
              <select value={pickerYear} onChange={(event) => setPickerYear(Number(event.target.value))}>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
              <select value={pickerMonth} onChange={(event) => setPickerMonth(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                ))}
              </select>
              <div className="life-activity-calendar__month-actions">
                <ActionButton onClick={() => setIsMonthPickerOpen(false)} variant="secondary">닫기</ActionButton>
                <ActionButton onClick={applyMonthPicker}>이동</ActionButton>
              </div>
            </div>
          ) : null}
        </div>
        <IconButton label="다음 달" onClick={() => moveMonth(1)} size="sm" tone="outline">
          <ChevronRight aria-hidden size={16} />
        </IconButton>
      </div>
      <div className="life-activity-calendar__weekdays">
        {WEEKDAYS.map((weekday, index) => (
          <span
            className={index === 0 ? "life-activity-calendar__weekday life-activity-calendar__weekday--sun" : index === 6 ? "life-activity-calendar__weekday life-activity-calendar__weekday--sat" : "life-activity-calendar__weekday"}
            key={weekday}
          >
            {weekday}
          </span>
        ))}
      </div>
      <div className="life-activity-calendar__grid">
        {calendarDays.map((day) => {
          const count = day.date ? activityCountsByDate.get(day.date) ?? 0 : 0;
          const weekday = day.date ? new Date(`${day.date}T00:00:00`).getDay() : -1;
          return (
            <button
              aria-pressed={day.date === date}
              className={[
                "life-activity-calendar__day",
                day.date === date ? "life-activity-calendar__day--selected" : "",
                weekday === 0 ? "life-activity-calendar__day--sun" : "",
                weekday === 6 ? "life-activity-calendar__day--sat" : "",
              ].filter(Boolean).join(" ")}
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
  );

  const activitySummaryCards = (
    <div className="life-activity-day-summary">
      <article className="life-activity-day-summary__card life-activity-day-summary__card--time">
        <span>시간</span>
        <strong>{selectedCoveredMinutes > 0 ? `${Math.round((selectedCoveredMinutes / 60) * 10) / 10}h` : "-"}</strong>
      </article>
      <article className="life-activity-day-summary__card life-activity-day-summary__card--expense">
        <span>지출</span>
        <strong>{selectedExpenseTotal > 0 ? formatWon(selectedExpenseTotal) : "-"}</strong>
      </article>
      <article className="life-activity-day-summary__card life-activity-day-summary__card--count">
        <span>기록 수</span>
        <strong>{selectedActivities.length > 0 ? `${selectedActivities.length}건` : "-"}</strong>
      </article>
    </div>
  );

  const activityList = selectedActivities.length > 0 ? (
    selectedActivities.map((activity) => (
      <UnifiedTimelineCard
        actions={
          <>
            <IconButton aria-label="활동 수정" disabled={isSaving || Boolean(deletingActivityId)} label="활동 수정" onClick={() => editActivity(activity)} size="sm" tone="outline">
              <Pencil aria-hidden size={14} />
            </IconButton>
            <IconButton
              aria-label={deletingActivityId === activity.id ? "삭제 중" : "활동 삭제"}
              disabled={Boolean(deletingActivityId)}
              label={deletingActivityId === activity.id ? "삭제 중" : "활동 삭제"}
              onClick={() => void deleteActivity(activity)}
              size="sm"
              tone="danger"
            >
              <Trash2 aria-hidden size={14} />
            </IconButton>
          </>
        }
        badge={<em className="record-timeline-card__badge record-timeline-card__badge--activity">{activity.category ?? "활동"}</em>}
        details={buildActivityDetailRows(activity).map((item) => ({ icon: item.icon, value: item.value }))}
        expanded={expandedActivityIds.includes(activity.id)}
        key={activity.id}
        layout={isMobile ? "mobile" : "desktop"}
        leading={
          <span className="record-timeline-card__time-badge">
            {activity.endTime ? <Clock3 aria-hidden size={13} /> : null}
            {formatActivityTime(activity)}
          </span>
        }
        onToggle={() =>
          setExpandedActivityIds((current) =>
            current.includes(activity.id) ? current.filter((id) => id !== activity.id) : [...current, activity.id],
          )
        }
        title={activity.title}
        tone="activity"
      />
    ))
  ) : (
    <div className="life-map-empty life-map-empty--compact">
      <NotebookPen aria-hidden size={28} />
      <strong>이 날짜에는 활동 기록이 아직 없어요.</strong>
      <p>{isMobile ? "상단의 추가 버튼으로 새 활동을 바로 남겨보세요." : "오른쪽 달력에서 날짜를 고르거나 왼쪽 입력 폼에서 활동을 하나 추가해보세요."}</p>
    </div>
  );

  return (
    <div className="life-tab-panel">
      {isMobile ? (
        <div className="life-activity-mobile">
          <MobileRecordFrame
            addButtonLabel="활동 추가"
            calendar={
              <RecordMonthCalendar
                countsByDate={activityCountsByDate}
                monthCursor={monthCursor}
                onNextMonth={() => moveMonth(1)}
                onPrevMonth={() => moveMonth(-1)}
                onSelectDate={selectDate}
                selectedDate={date}
              />
            }
            countLabel="활동 기록"
            countValue={`${selectedActivities.length}개`}
            dateLabel={formatFullDate(date)}
            isCalendarOpen={isCalendarExpanded}
            onAddClick={() => {
              setInputPanelMode("activity");
              setEntryMode("activity");
              setIsComposerOpen(true);
            }}
            onNextDate={() => selectDate(shiftLifeDateKey(date, 1))}
            onPrevDate={() => selectDate(shiftLifeDateKey(date, -1))}
            onToggleCalendar={() => setIsCalendarExpanded((current) => !current)}
            summary={activitySummaryCards}
          >
            <TimelineRail className="life-activity-timeline" headline={`${formatFullDate(date)} 타임라인`} meta={`${selectedActivities.length}개`}>
              {activityList}
            </TimelineRail>
          </MobileRecordFrame>

          {isComposerOpen ? (
            <MobileRecordSheet
              className="life-activity-mobile__sheet life-capture-editor life-capture-editor--mobile"
              description={`${formatFullDate(date)} 기준으로 바로 기록합니다.`}
              onClose={() => setIsComposerOpen(false)}
              title={editing ? "활동 수정" : inputPanelMode === "media" ? "사진 · 영상 업로드" : "활동 추가"}
            >
              <div className="life-activity-mobile__sheet-body">
                {inputPanelHeader}
                {formPanelContent}
                {formFeedback}
              </div>
            </MobileRecordSheet>
          ) : null}
        </div>
      ) : (
        <div className="life-activity-layout ui-workspace-grid ui-workspace-grid--form-detail">
          <SectionCard className="life-activity-form ui-workspace-panel ui-workspace-panel--tall">
            {inputPanelHeader}
            {formPanelContent}
            {formFeedback}
          </SectionCard>

          <SectionCard className="life-activity-list life-selected-day-panel ui-workspace-panel ui-workspace-panel--tall ui-sticky-side-panel">
            <div className="section-heading life-selected-day-panel__heading ui-panel-heading">
              <div className="ui-panel-heading__intro">
                <p className="eyebrow">선택한 날짜</p>
                <h2 className="life-selected-day-title">
                  <span>{formatFullDate(date)}</span>
                  <i aria-hidden />
                  <span>활동 <b>{selectedActivities.length}</b>건</span>
                </h2>
              </div>
            </div>
            {calendarPanel}
            {activitySummaryCards}
            <TimelineRail className="life-activity-timeline" headline={`${formatFullDate(date)} 타임라인`} meta={`${selectedActivities.length}개`}>
              {activityList}
            </TimelineRail>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

