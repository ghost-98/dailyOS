"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarCheck2, CalendarDays, Camera, HeartPulse, NotebookPen, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { createCalendarEventInDb } from "@/features/data/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { createTaskInDb } from "@/features/data/tasks/api";
import { getDefaultActivityTime } from "@/features/records/time/recordActivityHelpers";
import { formatDateKey, formatFullDate } from "@/features/records/time/recordDateTime";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/data/people/api";
import { createWeightRecordInDb, createWorkoutSessionInDb } from "@/features/data/health/api";
import { PeoplePickerField } from "@/components/shared/people/PeoplePickerField";
import { PlaceSearchField } from "@/components/shared/places/PlaceSearchField";
import type { LifeMediaUploadInput, PlanPlace, PersonRecord, TaskItem, WeightRecord, WorkoutSession, LifeActivityRecord } from "@/types/domain";
import { confirmAction } from "@/lib/actionGuards";
import { RecordLinkTargetField } from "@/features/screens/record/components/RecordLinkTargetField";
import type { RecordLinkTargetOption } from "@/features/screens/record/components/RecordLinkTargetField";
import type { RecordLinkedTarget } from "@/features/records/targets/recordTargets";
import { RecordCreateSheet } from "@/features/screens/record/components/RecordCreateSheet";
import { PlanCreateForm } from "@/features/screens/record/forms/PlanCreateForm";

type CreateType = "activity" | "task" | "event" | "log" | "health" | "photo";
type HealthMode = "weight" | "running";

const CREATE_CHOICES: Array<{ icon: typeof Activity; key: CreateType; label: string }> = [
  { icon: Activity, key: "activity", label: "활동" },
  { icon: CalendarCheck2, key: "task", label: "할 일" },
  { icon: CalendarDays, key: "event", label: "이벤트" },
  { icon: Camera, key: "photo", label: "사진" },
  { icon: NotebookPen, key: "log", label: "기록" },
  { icon: HeartPulse, key: "health", label: "건강" },
];

const BASE_ACTIVITY_CATEGORIES = ["생활", "이동", "업무", "공부", "만남", "운동", "식사", "소비", "수면", "기타"];
const CUSTOM_ACTIVITY_CATEGORY_STORAGE_KEY = "dailyos.record.customActivityCategories";

export function RecordCreateFlow() {
  const router = useRouter();
  const { data, setData, mutations } = useRecordsDataState();
  const createPerson = async (name: string) => createPersonInDb({ name });
  const [step, setStep] = useState<"choose" | CreateType>("choose");
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [message, setMessage] = useState("");

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

  return (
    <div className="life-page">
      <div className="life-axis-view">
        {step === "choose" ? (
          <SectionCard className="record-create-flow">
            <header className="section-heading ui-panel-heading ui-panel-heading--compact">
              <div className="ui-panel-heading__intro">
                <p className="eyebrow">추가하기</p>
                <h2>무엇을 추가할까요?</h2>
              </div>
            </header>
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
          </SectionCard>
        ) : null}

        {step === "activity" ? (
          <ActivityCreateForm
            defaultDate={formatDateKey(new Date())}
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
            defaultDate={formatDateKey(new Date())}
            message={message}
            onBack={() => setStep("choose")}
            onDone={finish}
            onMessage={setMessage}
            onSave={async (date, content, linkedTarget) => {
              await mutations.createDailyLog(date, content, linkedTarget);
              setMessage("기록을 추가했어요.");
            }}
            linkTargets={linkTargets}
          />
        ) : null}

        {step === "health" ? (
          <HealthCreateForm
            defaultDate={formatDateKey(new Date())}
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
            defaultDate={formatDateKey(new Date())}
            message={message}
            onBack={() => setStep("choose")}
            onDone={finish}
            onMessage={setMessage}
            onSavePhotos={mutations.uploadLifePhotos}
            linkTargets={linkTargets}
          />
        ) : null}

        {step === "event" ? (
          <EventTaskCreateFlow
            defaultDate={formatDateKey(new Date())}
            kind="event"
            onBack={() => setStep("choose")}
            onDone={finish}
            onSaveEvent={async (event) => {
              const saved = await createCalendarEventInDb(event);
              if (saved) setData((current) => ({ ...current, events: [saved, ...current.events] }));
            }}
            onSaveTask={async (task) => {
              const saved = await createTaskInDb(task);
              if (saved) setData((current) => ({ ...current, tasks: [saved, ...current.tasks] }));
            }}
            onCreatePerson={createPerson}
            people={people}
          />
        ) : null}

        {step === "task" ? (
          <EventTaskCreateFlow
            defaultDate={formatDateKey(new Date())}
            kind="task"
            onBack={() => setStep("choose")}
            onDone={finish}
            onSaveEvent={async (event) => {
              const saved = await createCalendarEventInDb(event);
              if (saved) setData((current) => ({ ...current, events: [saved, ...current.events] }));
            }}
            onSaveTask={async (task) => {
              const saved = await createTaskInDb(task);
              if (saved) setData((current) => ({ ...current, tasks: [saved, ...current.tasks] }));
            }}
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
  message,
  onBack,
  onCreatePerson,
  onDone,
  onMessage,
  onSave,
  people,
}: {
  defaultDate: string;
  message: string;
  onBack: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSave: (activity: LifeActivityRecord) => Promise<void> | void;
  people: PersonRecord[];
}) {
  const [date, setDate] = useState(defaultDate);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("기타");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [startTime, setStartTime] = useState(getDefaultActivityTime());
  const [endTime, setEndTime] = useState("");
  const [hasTime, setHasTime] = useState(true);
  const [hasEndTime, setHasEndTime] = useState(false);
  const [place, setPlace] = useState<PlanPlace | undefined>();
  const [startPlace, setStartPlace] = useState<PlanPlace | undefined>();
  const [endPlace, setEndPlace] = useState<PlanPlace | undefined>();
  const [transportMode, setTransportMode] = useState("");
  const [companions, setCompanions] = useState<string[]>([]);
  const [food, setFood] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOM_ACTIVITY_CATEGORY_STORAGE_KEY);
      if (saved) setCustomCategories(JSON.parse(saved) as string[]);
    } catch {
      setCustomCategories([]);
    }
  }, []);

  const categories = [...BASE_ACTIVITY_CATEGORIES, ...customCategories];

  const addCustomCategory = () => {
    const nextCategory = customCategory.trim();
    if (!nextCategory || categories.includes(nextCategory)) return;
    const nextCategories = [...customCategories, nextCategory];
    setCustomCategories(nextCategories);
    window.localStorage.setItem(CUSTOM_ACTIVITY_CATEGORY_STORAGE_KEY, JSON.stringify(nextCategories));
    setCategory(nextCategory);
    setCustomCategory("");
    setIsCategoryEditorOpen(false);
  };

  const removeCustomCategory = (target: string) => {
    const nextCategories = customCategories.filter((item) => item !== target);
    setCustomCategories(nextCategories);
    window.localStorage.setItem(CUSTOM_ACTIVITY_CATEGORY_STORAGE_KEY, JSON.stringify(nextCategories));
    if (category === target) setCategory("기타");
  };

  const save = async () => {
    if (!title.trim()) return;
    if (!confirmAction("활동을 추가할까요?")) return;
    setIsSaving(true);
    try {
      await onSave({
        id: `activity-${Date.now()}`,
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
      onMessage("활동을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet dateLabel={formatFullDate(date)} onClose={onBack} submit={<MobileSheetSubmitButton disabled={!title.trim() || isSaving} onClick={save}>{isSaving ? "저장 중..." : "활동 추가"}</MobileSheetSubmitButton>} title="활동 추가">
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
                  {isCustom ? <button aria-label={`${item} 태그 삭제`} className="record-create-flow__category-remove" onClick={() => removeCustomCategory(item)} type="button"><X aria-hidden size={11} /></button> : null}
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
                    addCustomCategory();
                  }
                }}
              />
              <button disabled={!customCategory.trim()} onClick={addCustomCategory} type="button">추가</button>
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
  message,
  onBack,
  onDone,
  onMessage,
  onSavePhotos,
  linkTargets,
}: {
  defaultDate: string;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSavePhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: RecordLinkedTarget) => Promise<void> | void;
  linkTargets: RecordLinkTargetOption[];
}) {
  const [date, setDate] = useState(defaultDate);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [linkedTarget, setLinkedTarget] = useState<RecordLinkedTarget | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (files.length === 0 || isSaving) return;
    if (!confirmAction("사진을 추가할까요?")) return;

    setIsSaving(true);
    try {
      await onSavePhotos(
        date,
        files.map((file) => ({ file })),
        caption.trim() || undefined,
        linkedTarget,
      );
      onMessage("사진을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet dateLabel={formatFullDate(date)} onClose={onBack} submit={<MobileSheetSubmitButton disabled={files.length === 0 || isSaving} onClick={save}>{isSaving ? "저장 중..." : "사진 추가"}</MobileSheetSubmitButton>} title="사진 추가">
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="연결 대상">
          <RecordLinkTargetField date={date} onChange={setLinkedTarget} options={linkTargets} value={linkedTarget} />
        </FormField>
        <FormField label="사진/영상">
          <input
            accept="image/*,video/*"
            multiple
            type="file"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </FormField>
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
  message,
  onBack,
  onDone,
  onMessage,
  onSave,
  linkTargets,
}: {
  defaultDate: string;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSave: (date: string, content: string, linkedTarget?: RecordLinkedTarget) => Promise<void> | void;
  linkTargets: RecordLinkTargetOption[];
}) {
  const [date, setDate] = useState(defaultDate);
  const [content, setContent] = useState("");
  const [linkedTarget, setLinkedTarget] = useState<RecordLinkedTarget | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    if (!confirmAction("기록을 추가할까요?")) return;
    setIsSaving(true);
    try {
      await onSave(date, content.trim(), linkedTarget);
      onMessage("기록을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RecordCreateSheet dateLabel={formatFullDate(date)} onClose={onBack} submit={<MobileSheetSubmitButton disabled={!content.trim() || isSaving} onClick={save}>{isSaving ? "저장 중..." : "기록 추가"}</MobileSheetSubmitButton>} title="기록 추가">
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
  kind,
  onBack,
  onDone,
  onSaveEvent,
  onCreatePerson,
  onSaveTask,
  people,
}: {
  defaultDate: string;
  kind: "event" | "task";
  onBack: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onDone: () => void;
  onSaveEvent: (event: CalendarEvent) => Promise<void> | void;
  onSaveTask: (task: TaskItem) => Promise<void> | void;
  people: PersonRecord[];
}) {
  return <PlanCreateForm defaultDate={defaultDate} kind={kind} onClose={onBack} onCreatePerson={onCreatePerson} onDone={onDone} onSaveEvent={onSaveEvent} onSaveTask={onSaveTask} people={people} />;
}









