"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarCheck2, CalendarDays, Camera, HeartPulse, NotebookPen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { MobileSheetSubmitButton } from "@/components/ui/MobileSheetSubmitButton";
import { EventCreateSheet, TaskCreateSheet } from "@/features/calendar/CalendarSheets";
import { createCalendarEventInDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { createTaskInDb } from "@/features/tasks/api";
import { getDefaultActivityTime } from "@/features/life/activityHelpers";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { useLifeDataState } from "@/features/life/useLifeDataState";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/people/api";
import { createWeightRecordInDb, createWorkoutSessionInDb } from "@/features/health/api";
import { PeoplePickerField } from "@/features/people/PeoplePickerField";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import type { LifeMediaUploadInput, PlanPlace, PersonRecord, TaskItem, WeightRecord, WorkoutSession, LifeActivityRecord } from "@/types/domain";
import { confirmAction } from "@/lib/actionGuards";

type CreateType = "activity" | "task" | "event" | "log" | "health" | "photo";
type HealthMode = "weight" | "running";

const CREATE_CHOICES: Array<{ icon: typeof Activity; key: CreateType; label: string }> = [
  { icon: Activity, key: "activity", label: "활동" },
  { icon: CalendarCheck2, key: "task", label: "할 일" },
  { icon: CalendarDays, key: "event", label: "이벤트" },
  { icon: NotebookPen, key: "log", label: "기록" },
  { icon: HeartPulse, key: "health", label: "건강" },
  { icon: Camera, key: "photo", label: "사진" },
];

const activityCategories = ["생활", "이동", "업무", "공부", "만남", "운동", "식사", "소비", "수면", "기타"];

export function RecordCreateFlow() {
  const router = useRouter();
  const { setData, mutations } = useLifeDataState();
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
                    <Icon aria-hidden size={18} />
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
            onSave={async (date, content) => {
              await mutations.createDailyLog(date, content);
              setMessage("기록을 추가했어요.");
            }}
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
  const [startTime, setStartTime] = useState(getDefaultActivityTime());
  const [isAllDay, setIsAllDay] = useState(false);
  const [place, setPlace] = useState<PlanPlace | undefined>();
  const [companions, setCompanions] = useState<string[]>([]);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
        isAllDay,
        startTime: isAllDay ? undefined : startTime || undefined,
        companions: companions.length > 0 ? companions.join(", ") : undefined,
        expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
        memo: memo.trim() || undefined,
        placeName: place?.name,
        placeAddress: place?.address,
      });
      onMessage("활동을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard className="record-create-flow__sheet">
      <header className="section-heading ui-panel-heading ui-panel-heading--compact">
        <div className="ui-panel-heading__intro">
          <p className="eyebrow">활동 추가</p>
          <h2>{formatFullDate(date)}</h2>
        </div>
        <IconButton label="뒤로" onClick={onBack} tone="outline">
          <X aria-hidden size={16} />
        </IconButton>
      </header>
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="제목">
          <input autoFocus placeholder="활동 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormField>
        <FormField label="유형">
          <div className="record-create-flow__category-grid" role="list" aria-label="활동 유형">
            {activityCategories.map((item) => (
              <button
                aria-pressed={category === item}
                className={category === item ? "record-create-flow__category-item record-create-flow__category-item--active" : "record-create-flow__category-item"}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="시간">
          <input disabled={isAllDay} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <label className="planner-option-toggle">
            <input checked={isAllDay} type="checkbox" onChange={(event) => setIsAllDay(event.target.checked)} />
            <span>하루종일</span>
          </label>
        </FormField>
        <FormField label="장소">
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />
        </FormField>
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
      <MobileSheetSubmitButton disabled={!title.trim() || isSaving} onClick={save}>
        {isSaving ? "저장 중..." : "활동 추가"}
      </MobileSheetSubmitButton>
    </SectionCard>
  );
}

function PhotoCreateForm({
  defaultDate,
  message,
  onBack,
  onDone,
  onMessage,
  onSavePhotos,
}: {
  defaultDate: string;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSavePhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string) => Promise<void> | void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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
      );
      onMessage("사진을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard className="record-create-flow__sheet">
      <header className="section-heading ui-panel-heading ui-panel-heading--compact">
        <div className="ui-panel-heading__intro">
          <p className="eyebrow">사진 추가</p>
          <h2>{formatFullDate(date)}</h2>
        </div>
        <IconButton label="뒤로" onClick={onBack} tone="outline">
          <X aria-hidden size={16} />
        </IconButton>
      </header>
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
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
      <MobileSheetSubmitButton disabled={files.length === 0 || isSaving} onClick={save}>
        {isSaving ? "저장 중..." : "사진 추가"}
      </MobileSheetSubmitButton>
    </SectionCard>
  );
}

function LogCreateForm({
  defaultDate,
  message,
  onBack,
  onDone,
  onMessage,
  onSave,
}: {
  defaultDate: string;
  message: string;
  onBack: () => void;
  onDone: () => void;
  onMessage: (value: string) => void;
  onSave: (date: string, content: string) => Promise<void> | void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    if (!confirmAction("기록을 추가할까요?")) return;
    setIsSaving(true);
    try {
      await onSave(date, content.trim());
      onMessage("기록을 추가했어요.");
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard className="record-create-flow__sheet">
      <header className="section-heading ui-panel-heading ui-panel-heading--compact">
        <div className="ui-panel-heading__intro">
          <p className="eyebrow">기록 추가</p>
          <h2>{formatFullDate(date)}</h2>
        </div>
        <IconButton label="뒤로" onClick={onBack} tone="outline">
          <X aria-hidden size={16} />
        </IconButton>
      </header>
      <div className="record-create-flow__form">
        <FormField label="날짜">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="내용">
          <textarea placeholder="오늘 기억하고 싶은 문장" value={content} onChange={(event) => setContent(event.target.value)} />
        </FormField>
        {message ? <p className="life-health-message">{message}</p> : null}
      </div>
      <MobileSheetSubmitButton disabled={!content.trim() || isSaving} onClick={save}>
        {isSaving ? "저장 중..." : "기록 추가"}
      </MobileSheetSubmitButton>
    </SectionCard>
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
    <SectionCard className="record-create-flow__sheet">
      <header className="section-heading ui-panel-heading ui-panel-heading--compact">
        <div className="ui-panel-heading__intro">
          <p className="eyebrow">건강 추가</p>
          <h2>{formatFullDate(date)}</h2>
        </div>
        <IconButton label="뒤로" onClick={onBack} tone="outline">
          <X aria-hidden size={16} />
        </IconButton>
      </header>
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
      <MobileSheetSubmitButton disabled={isSaving} onClick={save}>
        {isSaving ? "저장 중..." : mode === "weight" ? "몸무게 추가" : "러닝 추가"}
      </MobileSheetSubmitButton>
    </SectionCard>
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
  const [saving, setSaving] = useState(false);

  return kind === "event" ? (
    <EventCreateSheet
      allowedTypes={["event", "todo"]}
      defaultDate={defaultDate}
      defaultType="event"
      event={null}
      isSaving={saving}
      onClose={onBack}
      onCreatePerson={onCreatePerson}
      onSave={async (event) => {
        setSaving(true);
        try {
          await onSaveEvent(event);
          onDone();
        } finally {
          setSaving(false);
        }
      }}
      people={people}
    />
  ) : (
    <TaskCreateSheet
      defaultDate={defaultDate}
      isSaving={saving}
      onClose={onBack}
      onCreatePerson={onCreatePerson}
      onSave={async (task) => {
        setSaving(true);
        try {
          await onSaveTask(task);
          onDone();
        } finally {
          setSaving(false);
        }
      }}
      people={people}
      task={null}
    />
  );
}
