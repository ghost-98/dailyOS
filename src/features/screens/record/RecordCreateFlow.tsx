"use client";

import { useEffect, useState } from "react";
import { Activity, Banknote, Bed, CalendarCheck2, CalendarDays, Camera, HeartPulse, NotebookPen, Plus, Sunrise, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import type { CalendarEvent } from "@/features/calendar/data";
import { formatDateKey, formatFullDate, getRoundedCurrentTime } from "@/features/calendar/dateUtils";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/data/people/api";
import { createWeightRecordInDb, createWorkoutSessionInDb } from "@/features/data/health/api";
import { PeoplePickerField } from "@/components/shared/people/PeoplePickerField";
import { PlaceSearchField } from "@/components/shared/places/PlaceSearchField";
import type { DailyLogRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace, PersonRecord, TaskItem, WeightRecord, WorkoutSession, LifeActivityRecord } from "@/types/domain";
import { confirmAction } from "@/lib/actionGuards";
import { RecordLinkTargetField } from "@/features/screens/record/components/RecordLinkTargetField";
import type { RecordLinkTargetOption } from "@/features/screens/record/components/RecordLinkTargetField";
import type { RecordLinkedTarget } from "@/features/records/targets/linkedTarget";
import { RecordCreateSheet } from "@/features/screens/record/components/RecordCreateSheet";
import { PlanCreateForm } from "@/features/screens/record/forms/PlanCreateForm";
import { IncomeCreateForm } from "@/features/screens/record/forms/IncomeCreateForm";
import { SleepWakeCreateForm } from "@/features/screens/record/forms/SleepWakeCreateForm";
import { createActivityCategoryInDb, deleteActivityCategoryFromDb, fetchActivityCategoriesFromDb } from "@/features/data/records/activityCategories";

type CreateType = "activity" | "task" | "event" | "log" | "health" | "photo" | "income" | "bedtime" | "wake";
type HealthMode = "weight" | "running";

const CREATE_CHOICES: Array<{ icon: typeof Activity; key: CreateType; label: string }> = [
  { icon: Activity, key: "activity", label: "활동" },
  { icon: CalendarCheck2, key: "task", label: "할 일" },
  { icon: CalendarDays, key: "event", label: "이벤트" },
  { icon: Camera, key: "photo", label: "사진" },
  { icon: NotebookPen, key: "log", label: "기록" },
  { icon: HeartPulse, key: "health", label: "건강" },
  { icon: Banknote, key: "income", label: "수입" },
  { icon: Bed, key: "bedtime", label: "취침" },
  { icon: Sunrise, key: "wake", label: "기상" },
];

const BASE_ACTIVITY_CATEGORIES = ["생활", "이동", "업무", "공부", "만남", "운동", "식사", "소비", "수면", "독서", "영화", "기타"];

export function RecordCreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, setData, mutations } = useRecordsDataState();
  const createPerson = async (name: string) => createPersonInDb({ name });
  const editType = parseCreateType(searchParams.get("edit"));
  const createType = parseCreateType(searchParams.get("create"));
  const editId = searchParams.get("id");
  const defaultDate = searchParams.get("date") ?? formatDateKey(new Date());
  const [step, setStep] = useState<"choose" | CreateType>(() => editType ?? createType ?? "choose");
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (editType) return;
    if (createType) setStep(createType);
  }, [createType, editType]);

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

  const finish = () => {
    router.push("/m/day");
  };

  const linkTargets: RecordLinkTargetOption[] = [
    ...data.activities.map((item) => ({ date: item.date, id: item.id, title: item.title, type: "activity" as const })),
    ...data.tasks.map((item) => ({ date: item.scheduledDate, id: item.id, title: item.title, type: "todo" as const })),
    ...data.events.filter((item) => item.type === "event").map((item) => ({ date: item.date, id: item.id, title: item.title, type: "event" as const })),
  ];

  const editTargetExists = !editType || !editId || (
    editType === "activity" ? data.activities.some((item) => item.id === editId) :
    editType === "task" ? data.tasks.some((item) => item.id === editId) :
    editType === "event" ? data.events.some((item) => item.id === editId) :
    editType === "log" ? data.dailyLogs.some((item) => item.id === editId) :
    editType === "photo" ? data.lifePhotos.some((item) => item.id === editId) :
    editType === "income" ? data.incomes.some((item) => item.id === editId) : true
  );

  if (editType && editId && !editTargetExists) {
    return <div className="life-page"><div className="life-calendar-db-empty">{isLoading ? "수정할 내용을 불러오는 중..." : "수정할 내용을 찾지 못했습니다."}</div></div>;
  }

  return (
    <div className="life-page">
      <div className="life-axis-view">
        {step === "choose" ? (
          <div className="record-create-flow">
            <div className="record-create-flow__choices">
              {CREATE_CHOICES.map((choice) => {
                const Icon = choice.icon;
                return (
                  <button className="record-create-flow__choice" key={choice.key} type="button" onClick={() => setStep(choice.key)}>
                    <span className="record-create-flow__choice-icon">
                      <Icon aria-hidden size={18} />
                    </span>
                    <strong>{choice.label}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "activity" ? (
          <ActivityCreateForm
            key={editType === "activity" ? data.activities.find((item) => item.id === editId)?.id ?? "activity-loading" : "activity-create"}
            defaultDate={defaultDate}
            initialActivity={editType === "activity" ? data.activities.find((item) => item.id === editId) : undefined}
            message={message}
            onBack={() => setStep("choose")}
            onCreatePerson={createPerson}
            onDone={finish}
            onMessage={setMessage}
            onSave={async (payload) => {
              await mutations.saveActivity(payload);
              setMessage("활동을 추가했어요.");
            }}
            people={people}
          />
        ) : null}

        {step === "log" ? (
          <LogCreateForm
            key={editType === "log" ? data.dailyLogs.find((item) => item.id === editId)?.id ?? "log-loading" : "log-create"}
            defaultDate={defaultDate}
            initialLog={editType === "log" ? data.dailyLogs.find((item) => item.id === editId) : undefined}
            message={message}
            onBack={() => setStep("choose")}
            onDone={finish}
            onMessage={setMessage}
            onSave={async (date, content, linkedTarget) => {
              const existing = editType === "log" ? data.dailyLogs.find((item) => item.id === editId) : undefined;
              if (existing) await mutations.updateDailyLog({ ...existing, content, date, linkedTargetId: linkedTarget?.id, linkedTargetTitle: linkedTarget?.title, linkedTargetType: linkedTarget?.type });
              else await mutations.createDailyLog(date, content, linkedTarget);
              setMessage("기록을 추가했어요.");
            }}
            linkTargets={linkTargets}
          />
        ) : null}

        {step === "health" ? (
          <HealthCreateForm
            defaultDate={defaultDate}
            message={message}
            onBack={() => setStep("choose")}
            onDone={finish}
            onMessage={setMessage}
            onSaveWorkout={async (session) => {
              const saved = await createWorkoutSessionInDb(session);
              if (saved) setData((current) => ({ ...current, workouts: [saved, ...current.workouts] }));
            }}
            onSaveWeight={async (record) => {
              const saved = await createWeightRecordInDb(record);
              if (saved) setData((current) => ({ ...current, weights: [saved, ...current.weights] }));
            }}
          />
        ) : null}

        {step === "photo" ? (
          <PhotoCreateForm
            key={editType === "photo" ? data.lifePhotos.find((item) => item.id === editId)?.id ?? "photo-loading" : "photo-create"}
            defaultDate={defaultDate}
            initialPhoto={editType === "photo" ? data.lifePhotos.find((item) => item.id === editId) : undefined}
            message={message}
            onBack={() => setStep("choose")}
            onDone={finish}
            onMessage={setMessage}
            onSavePhotos={mutations.uploadLifePhotos}
            onUpdatePhoto={mutations.updateLifePhotoDetails}
            linkTargets={linkTargets}
          />
        ) : null}

        {step === "income" ? (
          <IncomeCreateForm
            key={editType === "income" ? data.incomes.find((item) => item.id === editId)?.id ?? "income-loading" : "income-create"}
            defaultDate={defaultDate}
            initialRecord={editType === "income" ? data.incomes.find((item) => item.id === editId) : undefined}
            onBack={() => setStep("choose")}
            onDone={finish}
            onSave={editType === "income" ? mutations.updateIncome : mutations.createIncome}
          />
        ) : null}

        {step === "bedtime" || step === "wake" ? (
          <SleepWakeCreateForm
            defaultDate={defaultDate}
            mode={step}
            onBack={() => setStep("choose")}
            onDone={finish}
            onSave={mutations.saveActivity}
          />
        ) : null}

        {step === "event" ? (
          <EventTaskCreateFlow
            key={editType === "event" ? data.events.find((item) => item.id === editId)?.id ?? "event-loading" : "event-create"}
            defaultDate={defaultDate}
            kind="event"
            initialEvent={editType === "event" ? data.events.find((item) => item.id === editId) : undefined}
            onBack={() => setStep("choose")}
            onDone={finish}
            onSaveEvent={editType === "event" ? mutations.updateEvent : mutations.createEvent}
            onSaveTask={mutations.createTask}
            onCreatePerson={createPerson}
            people={people}
          />
        ) : null}

        {step === "task" ? (
          <EventTaskCreateFlow
            key={editType === "task" ? data.tasks.find((item) => item.id === editId)?.id ?? "task-loading" : "task-create"}
            defaultDate={defaultDate}
            kind="task"
            initialTask={editType === "task" ? data.tasks.find((item) => item.id === editId) : undefined}
            onBack={() => setStep("choose")}
            onDone={finish}
            onSaveEvent={mutations.createEvent}
            onSaveTask={editType === "task" ? mutations.updateTask : mutations.createTask}
            onCreatePerson={createPerson}
            people={people}
          />
        ) : null}
      </div>
    </div>
  );
}

function ActivityCreateForm({
  defaultDate,
  initialActivity,
  message,
  onBack,
  onCreatePerson,
  onDone,
  onMessage,
  onSave,
  people,
}: {
  defaultDate: string;
  initialActivity?: LifeActivityRecord;
  message: string;
  onBack: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSave: (activity: LifeActivityRecord) => Promise<void> | void;
  people: PersonRecord[];
}) {
  const [date, setDate] = useState(initialActivity?.date ?? defaultDate);
  const [title, setTitle] = useState(initialActivity?.title ?? "");
  const [category, setCategory] = useState(initialActivity?.category ?? "기타");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [startTime, setStartTime] = useState(initialActivity?.startTime ?? getRoundedCurrentTime());
  const [endTime, setEndTime] = useState(initialActivity?.endTime ?? "");
  const [hasTime, setHasTime] = useState(!(initialActivity?.isAllDay ?? false));
  const [hasEndTime, setHasEndTime] = useState(Boolean(initialActivity?.endTime));
  const [place, setPlace] = useState<PlanPlace | undefined>(() => toActivityPlace(initialActivity?.placeName, initialActivity?.placeAddress));
  const [startPlace, setStartPlace] = useState<PlanPlace | undefined>(() => toActivityPlace(initialActivity?.startPlaceName, initialActivity?.startPlaceAddress));
  const [endPlace, setEndPlace] = useState<PlanPlace | undefined>(() => toActivityPlace(initialActivity?.endPlaceName, initialActivity?.endPlaceAddress));
  const [transportMode, setTransportMode] = useState(initialActivity?.transportMode ?? "");
  const [companions, setCompanions] = useState<string[]>(() => initialActivity?.companions?.split(",").map((item) => item.trim()).filter(Boolean) ?? []);
  const [food, setFood] = useState(initialActivity?.food ?? "");
  const [expenseAmount, setExpenseAmount] = useState(initialActivity?.expenseAmount ? String(initialActivity.expenseAmount) : "");
  const [memo, setMemo] = useState(initialActivity?.memo ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const categories = await fetchActivityCategoriesFromDb();
        if (isMounted) setCustomCategories(categories ?? []);
      } catch (error) {
        console.error("Failed to load activity categories", error);
      }
    };
    void loadCategories();
    return () => { isMounted = false; };
  }, []);

  const categories = [...BASE_ACTIVITY_CATEGORIES, ...customCategories];

  const addCustomCategory = async () => {
    const nextCategory = customCategory.trim();
    if (!nextCategory || categories.includes(nextCategory)) return;
    const savedCategory = await createActivityCategoryInDb(nextCategory);
    if (!savedCategory) return;
    setCustomCategories((current) => [...current.filter((item) => item !== savedCategory), savedCategory].sort());
    setCategory(savedCategory);
    setCustomCategory("");
    setIsCategoryEditorOpen(false);
  };

  const removeCustomCategory = async (target: string) => {
    const deleted = await deleteActivityCategoryFromDb(target);
    if (!deleted) return;
    setCustomCategories((current) => current.filter((item) => item !== target));
    if (category === target) setCategory("기타");
  };

  const save = async () => {
    if (!title.trim()) return;
    if (!confirmAction(initialActivity ? "활동 수정을 저장할까요?" : "활동을 추가할까요?")) return;
    setIsSaving(true);
    try {
      await onSave({
        ...initialActivity,
        id: initialActivity?.id ?? `activity-${Date.now()}`,
        date,
        title: title.trim(),
        category,
        isAllDay: !hasTime,
        startTime: hasTime ? startTime || undefined : undefined,
        endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
        companions: companions.length > 0 ? companions.join(", ") : undefined,
        expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
        memo: memo.trim() || undefined,
        placeName: category === "이동" ? endPlace?.name : place?.name,
        placeAddress: category === "이동" ? endPlace?.address : place?.address,
        startPlaceName: category === "이동" ? startPlace?.name : undefined,
        startPlaceAddress: category === "이동" ? startPlace?.address : undefined,
        endPlaceName: category === "이동" ? endPlace?.name : undefined,
        endPlaceAddress: category === "이동" ? endPlace?.address : undefined,
        transportMode: category === "이동" ? transportMode.trim() || undefined : undefined,
        food: category === "식사" ? food.trim() || undefined : undefined,
      });
      onMessage(initialActivity ? "활동을 수정했어요." : "활동을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet dateLabel={formatFullDate(date)} onClose={onBack} submit={<MobileSheetSubmitButton disabled={!title.trim() || isSaving} onClick={save}>{isSaving ? "저장 중..." : initialActivity ? "수정 저장" : "활동 추가"}</MobileSheetSubmitButton>} title={initialActivity ? "활동 수정" : "활동 추가"}>
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="제목">
          <input autoFocus placeholder="활동 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormField>
        <FormField label="유형">
          <div className="record-create-flow__category-grid" role="list" aria-label="활동 유형">
            {categories.map((item) => {
              const isCustom = customCategories.includes(item);
              return (
                <span className={category === item ? "record-create-flow__category-item record-create-flow__category-item--active" : "record-create-flow__category-item"} key={item}>
                  <button aria-pressed={category === item} onClick={() => setCategory(item)} type="button">{item}</button>
                  {isCustom ? <button aria-label={`${item} 태그 삭제`} className="record-create-flow__category-remove" onClick={() => void removeCustomCategory(item)} type="button"><X aria-hidden size={11} /></button> : null}
                </span>
              );
            })}
            <button className="record-create-flow__category-add" onClick={() => setIsCategoryEditorOpen((current) => !current)} type="button">
              <Plus aria-hidden size={13} /> 태그 추가
            </button>
          </div>
          {isCategoryEditorOpen ? (
            <div className="record-create-flow__category-editor">
              <input
                aria-label="새 활동 태그"
                placeholder="새 태그"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addCustomCategory();
                  }
                }}
              />
              <button disabled={!customCategory.trim()} onClick={() => void addCustomCategory()} type="button">추가</button>
            </div>
          ) : null}
        </FormField>
        <FormField label="시간">
          <div className="record-create-flow__time-toggle-row" role="group" aria-label="시간 설정">
            <button
              aria-pressed={hasTime}
              className={hasTime ? "planner-option-toggle planner-option-toggle--active" : "planner-option-toggle"}
              onClick={() => {
                setHasTime((current) => {
                  const next = !current;
                  if (!next) setHasEndTime(false);
                  return next;
                });
              }}
              type="button"
            >
              <span>시간 사용</span>
            </button>
            <button
              aria-pressed={hasTime && hasEndTime}
              className={hasTime && hasEndTime ? "planner-option-toggle planner-option-toggle--active" : "planner-option-toggle"}
              disabled={!hasTime}
              onClick={() => setHasEndTime((current) => !current)}
              type="button"
            >
              <span>종료 시간 사용</span>
            </button>
          </div>
          {hasTime ? (
            <div className="record-create-flow__time-grid">
              <label className="record-create-flow__time-field">
                <span>시작 시간</span>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>
              {hasEndTime ? (
                <label className="record-create-flow__time-field">
                  <span>종료 시간</span>
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </label>
              ) : null}
            </div>
          ) : null}
        </FormField>
        {category === "이동" ? (
          <div className="record-create-flow__conditional-section">
            <FormField label="출발지">
              <PlaceSearchField selectedPlace={startPlace} onSelect={setStartPlace} />
            </FormField>
            <FormField label="도착지">
              <PlaceSearchField selectedPlace={endPlace} onSelect={setEndPlace} />
            </FormField>
            <FormField label="이동 수단">
              <input placeholder="예: 도보, 지하철, 버스, 택시, 자차" value={transportMode} onChange={(event) => setTransportMode(event.target.value)} />
            </FormField>
          </div>
        ) : (
          <FormField label="장소">
            <PlaceSearchField selectedPlace={place} onSelect={setPlace} />
          </FormField>
        )}
        {category === "식사" ? (
          <div className="record-create-flow__conditional-section">
            <FormField label="식사 메뉴">
              <input placeholder="예: 샐러드, 라떼, 파스타" value={food} onChange={(event) => setFood(event.target.value)} />
            </FormField>
          </div>
        ) : null}
        <FormField label="함께한 사람">
          <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
        </FormField>
        <FormField label="지출">
          <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
        </FormField>
        <FormField label="메모">
          <textarea placeholder="간단한 메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </FormField>
        {message ? <p className="life-health-message">{message}</p> : null}
      </div>
    </RecordCreateSheet>
  );
}

function PhotoCreateForm({
  defaultDate,
  initialPhoto,
  message,
  onBack,
  onDone,
  onMessage,
  onSavePhotos,
  onUpdatePhoto,
  linkTargets,
}: {
  defaultDate: string;
  initialPhoto?: LifePhotoRecord;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSavePhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: RecordLinkedTarget) => Promise<void> | void;
  onUpdatePhoto: (id: string, date: string, caption?: string, linkedTarget?: RecordLinkedTarget) => Promise<void> | void;
  linkTargets: RecordLinkTargetOption[];
}) {
  const [date, setDate] = useState(initialPhoto?.date ?? defaultDate);
  const [caption, setCaption] = useState(initialPhoto?.caption ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [linkedTarget, setLinkedTarget] = useState<RecordLinkedTarget | undefined>(() => initialPhoto?.linkedTargetId && initialPhoto.linkedTargetType ? { id: initialPhoto.linkedTargetId, title: initialPhoto.linkedTargetTitle ?? "연결 대상", type: initialPhoto.linkedTargetType } : undefined);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if ((!initialPhoto && files.length === 0) || isSaving) return;
    if (!confirmAction(initialPhoto ? "사진 수정을 저장할까요?" : "사진을 추가할까요?")) return;

    setIsSaving(true);
    try {
      if (initialPhoto) await onUpdatePhoto(initialPhoto.id, date, caption.trim() || undefined, linkedTarget);
      else await onSavePhotos(date, files.map((file) => ({ file })), caption.trim() || undefined, linkedTarget);
      onMessage(initialPhoto ? "사진을 수정했어요." : "사진을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet dateLabel={formatFullDate(date)} onClose={onBack} submit={<MobileSheetSubmitButton disabled={(!initialPhoto && files.length === 0) || isSaving} onClick={save}>{isSaving ? "저장 중..." : initialPhoto ? "수정 저장" : "사진 추가"}</MobileSheetSubmitButton>} title={initialPhoto ? "사진 수정" : "사진 추가"}>
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="연결 대상">
          <RecordLinkTargetField date={date} onChange={setLinkedTarget} options={linkTargets} value={linkedTarget} />
        </FormField>
        {!initialPhoto ? <FormField label="사진/영상">
          <input
            accept="image/*,video/*"
            multiple
            type="file"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </FormField> : null}
        <FormField label="설명">
          <input placeholder="예: 산책 기록, 모임 사진" value={caption} onChange={(event) => setCaption(event.target.value)} />
        </FormField>
        {files.length > 0 ? <p className="life-health-message">{files.length}개 파일을 선택했어요.</p> : null}
        {message ? <p className="life-health-message">{message}</p> : null}
      </div>
    </RecordCreateSheet>
  );
}

function LogCreateForm({
  defaultDate,
  initialLog,
  message,
  onBack,
  onDone,
  onMessage,
  onSave,
  linkTargets,
}: {
  defaultDate: string;
  initialLog?: DailyLogRecord;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSave: (date: string, content: string, linkedTarget?: RecordLinkedTarget) => Promise<void> | void;
  linkTargets: RecordLinkTargetOption[];
}) {
  const [date, setDate] = useState(initialLog?.date ?? defaultDate);
  const [content, setContent] = useState(initialLog?.content ?? "");
  const [linkedTarget, setLinkedTarget] = useState<RecordLinkedTarget | undefined>(() => initialLog?.linkedTargetId && initialLog.linkedTargetType ? { id: initialLog.linkedTargetId, title: initialLog.linkedTargetTitle ?? "연결 대상", type: initialLog.linkedTargetType } : undefined);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    if (!confirmAction(initialLog ? "기록 수정을 저장할까요?" : "기록을 추가할까요?")) return;
    setIsSaving(true);
    try {
      await onSave(date, content.trim(), linkedTarget);
      onMessage(initialLog ? "기록을 수정했어요." : "기록을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet dateLabel={formatFullDate(date)} onClose={onBack} submit={<MobileSheetSubmitButton disabled={!content.trim() || isSaving} onClick={save}>{isSaving ? "저장 중..." : initialLog ? "수정 저장" : "기록 추가"}</MobileSheetSubmitButton>} title={initialLog ? "기록 수정" : "기록 추가"}>
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="연결 대상">
          <RecordLinkTargetField date={date} onChange={setLinkedTarget} options={linkTargets} value={linkedTarget} />
        </FormField>
        <FormField label="내용">
          <textarea placeholder="오늘 기억하고 싶은 문장" value={content} onChange={(event) => setContent(event.target.value)} />
        </FormField>
        {message ? <p className="life-health-message">{message}</p> : null}
      </div>
    </RecordCreateSheet>
  );
}

function HealthCreateForm({
  defaultDate,
  message,
  onBack,
  onDone,
  onMessage,
  onSaveWeight,
  onSaveWorkout,
}: {
  defaultDate: string;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSaveWeight: (record: WeightRecord) => Promise<void> | void;
  onSaveWorkout: (session: WorkoutSession) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<HealthMode>("weight");
  const [date, setDate] = useState(defaultDate);
  const [weightKg, setWeightKg] = useState("");
  const [measuredAtTime, setMeasuredAtTime] = useState("");
  const [measuredFasted, setMeasuredFasted] = useState(true);
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!confirmAction(mode === "weight" ? "체중을 추가할까요?" : "러닝을 추가할까요?")) return;
    setIsSaving(true);
    try {
      if (mode === "weight") {
        if (!weightKg || !measuredAtTime) return;
        await onSaveWeight({
          id: `weight-${Date.now()}`,
          date,
          weightKg: Number(weightKg),
          measuredAtTime,
          measuredFasted,
        });
      } else {
        const total = Number(durationMinutes || 0) * 60 + Number(durationSeconds || 0);
        if (!distanceKm || total <= 0) return;
        await onSaveWorkout({
          id: `run-${Date.now()}`,
          condition: "normal",
          date,
          distanceKm: Number(distanceKm),
          durationMinutes: Math.max(1, Math.ceil(total / 60)),
          durationSeconds: total,
          type: "running",
        });
      }
      onMessage(mode === "weight" ? "체중을 추가했어요." : "러닝을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet
      dateLabel={formatFullDate(date)}
      onClose={onBack}
      submit={<MobileSheetSubmitButton disabled={isSaving} onClick={save}>{isSaving ? "저장 중..." : mode === "weight" ? "몸무게 추가" : "러닝 추가"}</MobileSheetSubmitButton>}
      title="건강 추가"
    >
      <div className="record-create-flow__form">
        <div className="record-create-flow__mode-switch">
          <button className={mode === "weight" ? "record-create-flow__mode-switch-item record-create-flow__mode-switch-item--active" : "record-create-flow__mode-switch-item"} onClick={() => setMode("weight")} type="button">
            몸무게
          </button>
          <button className={mode === "running" ? "record-create-flow__mode-switch-item record-create-flow__mode-switch-item--active" : "record-create-flow__mode-switch-item"} onClick={() => setMode("running")} type="button">
            러닝
          </button>
        </div>
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        {mode === "weight" ? (
          <>
            <FormField label="몸무게">
              <input inputMode="decimal" placeholder="kg" type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
            </FormField>
            <FormField label="측정 시간">
              <input type="time" value={measuredAtTime} onChange={(event) => setMeasuredAtTime(event.target.value)} />
            </FormField>
            <FormField label="공복 여부">
              <label className="planner-option-toggle">
                <input checked={measuredFasted} type="checkbox" onChange={(event) => setMeasuredFasted(event.target.checked)} />
                <span>6시간 이상 공복</span>
              </label>
            </FormField>
          </>
        ) : (
          <>
            <FormField label="거리">
              <input inputMode="decimal" placeholder="km" type="number" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
            </FormField>
            <FormField label="시간">
              <input inputMode="numeric" placeholder="분" type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
            </FormField>
            <FormField label="초">
              <input inputMode="numeric" max="59" placeholder="초" type="number" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} />
            </FormField>
          </>
        )}
        {message ? <p className="life-health-message">{message}</p> : null}
      </div>
    </RecordCreateSheet>
  );
}

function EventTaskCreateFlow({
  defaultDate,
  initialEvent,
  initialTask,
  kind,
  onBack,
  onDone,
  onSaveEvent,
  onCreatePerson,
  onSaveTask,
  people,
}: {
  defaultDate: string;
  initialEvent?: CalendarEvent;
  initialTask?: TaskItem;
  kind: "event" | "task";
  onBack: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onDone: () => void;
  onSaveEvent: (event: CalendarEvent) => Promise<void> | void;
  onSaveTask: (task: TaskItem) => Promise<void> | void;
  people: PersonRecord[];
}) {
  return <PlanCreateForm defaultDate={defaultDate} initialEvent={initialEvent} initialTask={initialTask} kind={kind} onClose={onBack} onCreatePerson={onCreatePerson} onDone={onDone} onSaveEvent={onSaveEvent} onSaveTask={onSaveTask} people={people} />;
}

function parseCreateType(value: string | null): CreateType | null {
  return CREATE_CHOICES.some((choice) => choice.key === value) ? value as CreateType : null;
}

function toActivityPlace(name?: string, address?: string): PlanPlace | undefined {
  if (!name) return undefined;
  return { address: address ?? "", latitude: 0, longitude: 0, name };
}









