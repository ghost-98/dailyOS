"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, Pencil, Plus, Scale, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { WeightRecord, WorkoutCondition, WorkoutSession, WorkoutType } from "@/types/domain";
import {
  createWeightRecordInDb,
  createWorkoutSessionInDb,
  deleteWeightRecordFromDb,
  deleteWorkoutSessionFromDb,
  fetchWeightRecordsFromDb,
  fetchWorkoutSessionsFromDb,
  updateWeightRecordInDb,
  updateWorkoutSessionInDb,
} from "./api";

const initialDate = new Date().toISOString().slice(0, 10);

const workoutTypeLabels: Record<WorkoutType, string> = {
  running: "러닝",
  stretching: "스트레칭",
  bodyweight: "맨몸운동",
  weight: "웨이트",
  etc: "기타",
};

const conditionLabels: Record<WorkoutCondition, string> = {
  good: "좋음",
  normal: "보통",
  low: "낮음",
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatSelectedDay(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00`));
}

export function HealthView() {
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sheetType, setSheetType] = useState<"weight" | "workout" | null>(null);
  const [editingWeight, setEditingWeight] = useState<WeightRecord | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()])
      .then(([dbWeights, dbWorkouts]) => {
        if (!isMounted) return;
        setWeights(dbWeights ?? []);
        setWorkouts(dbWorkouts ?? []);
      })
      .catch((error) => console.error("Failed to load health records from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const weight = useMemo(() => weights.find((record) => record.date === selectedDate), [selectedDate, weights]);
  const sessions = useMemo(() => workouts.filter((session) => session.date === selectedDate), [selectedDate, workouts]);
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const weightTrend = weights.slice(0, 12).reverse();

  const saveWeight = async (record: WeightRecord) => {
    const exists = weights.some((item) => item.id === record.id);
    const savedRecord = exists ? await updateWeightRecordInDb(record) : await createWeightRecordInDb(record);
    const nextRecord = savedRecord ?? record;

    setWeights((current) => {
      const next = exists ? current.map((item) => (item.id === record.id ? nextRecord : item)) : [nextRecord, ...current];
      return next.sort((a, b) => b.date.localeCompare(a.date));
    });
    setEditingWeight(null);
    setSheetType(null);
  };

  const saveWorkout = async (session: WorkoutSession) => {
    const exists = workouts.some((item) => item.id === session.id);
    const savedSession = exists ? await updateWorkoutSessionInDb(session) : await createWorkoutSessionInDb(session);
    const nextSession = savedSession ?? session;

    setWorkouts((current) => (exists ? current.map((item) => (item.id === session.id ? nextSession : item)) : [nextSession, ...current]));
    setEditingWorkout(null);
    setSheetType(null);
  };

  const deleteWeight = async (id: string) => {
    await deleteWeightRecordFromDb(id);
    setWeights((current) => current.filter((record) => record.id !== id));
  };

  const deleteWorkout = async (id: string) => {
    await deleteWorkoutSessionFromDb(id);
    setWorkouts((current) => current.filter((session) => session.id !== id));
  };

  return (
    <div className="health-page">
      <header className="health-header page-header">
        <div>
          <h1>건강</h1>
          <div className="today__date">
            <HeartPulse aria-hidden size={20} />
            <span>날짜별 몸무게와 운동 기록을 관리합니다.</span>
          </div>
        </div>
        <div className="health-actions">
          <button
            className="header-action"
            onClick={() => {
              setEditingWeight(null);
              setSheetType("weight");
            }}
            type="button"
          >
            <Scale aria-hidden size={18} />
            몸무게 기록
          </button>
          <button
            className="header-action"
            onClick={() => {
              setEditingWorkout(null);
              setSheetType("workout");
            }}
            type="button"
          >
            <Plus aria-hidden size={18} />
            운동 기록
          </button>
        </div>
      </header>

      <SectionCard className="task-day-switcher">
        <button aria-label="이전 날짜" onClick={() => setSelectedDate((date) => addDays(date, -1))} type="button">
          <ChevronLeft aria-hidden size={20} />
        </button>
        <button className="task-date-trigger" type="button">{formatSelectedDay(selectedDate)}</button>
        <button aria-label="다음 날짜" onClick={() => setSelectedDate((date) => addDays(date, 1))} type="button">
          <ChevronRight aria-hidden size={20} />
        </button>
      </SectionCard>

      <div className="health-daily-grid">
        <WeightCard
          onDelete={deleteWeight}
          onEdit={(record) => {
            setEditingWeight(record);
            setSheetType("weight");
          }}
          weight={weight}
          weightTrend={weightTrend}
        />

        <SectionCard className="workout-section">
          <div className="section-heading">
            <div className="card-title">
              <Dumbbell aria-hidden size={20} />
              <span>운동 기록</span>
            </div>
            <div className="workout-section__summary">
              <strong>{sessions.length}건</strong>
              <span>{totalMinutes}분</span>
            </div>
          </div>

          <div className="workout-session-list">
            {sessions.length > 0 ? sessions.map((session) => (
              <WorkoutSessionCard
                key={session.id}
                onDelete={deleteWorkout}
                onEdit={(target) => {
                  setEditingWorkout(target);
                  setSheetType("workout");
                }}
                session={session}
              />
            )) : (
              <div className="health-empty">
                <Activity aria-hidden size={24} />
                <strong>운동 기록이 없습니다.</strong>
                <p>{isLoading ? "불러오는 중입니다." : "운동을 기록하면 이 날짜에 표시됩니다."}</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {sheetType === "weight" ? (
        <WeightRecordSheet
          record={editingWeight}
          selectedDate={selectedDate}
          onClose={() => {
            setEditingWeight(null);
            setSheetType(null);
          }}
          onSave={saveWeight}
        />
      ) : null}
      {sheetType === "workout" ? (
        <WorkoutRecordSheet
          selectedDate={selectedDate}
          session={editingWorkout}
          onClose={() => {
            setEditingWorkout(null);
            setSheetType(null);
          }}
          onSave={saveWorkout}
        />
      ) : null}
    </div>
  );
}

function WeightCard({
  onDelete,
  onEdit,
  weight,
  weightTrend,
}: {
  onDelete: (id: string) => void;
  onEdit: (record: WeightRecord) => void;
  weight?: WeightRecord;
  weightTrend: WeightRecord[];
}) {
  return (
    <SectionCard className="weight-card">
      <div className="card-title">
        <Scale aria-hidden size={20} />
        <span>몸무게</span>
      </div>
      {weight ? (
        <>
          <strong>{weight.weightKg} kg</strong>
          <div className="weight-flags">
            <span className={weight.measuredFasted ? "weight-flag weight-flag--active" : "weight-flag"}>
              {weight.measuredFasted ? <Check aria-hidden size={14} /> : null}
              공복 측정
            </span>
          </div>
          {weightTrend.length > 1 ? (
            <div className="weight-card__trend">
              <span>최근 기록</span>
              <div className="weight-sparkline" aria-hidden>
                {weightTrend.map((record) => (
                  <span key={record.id} style={{ height: `${Math.max(20, 100 - (record.weightKg - 70) * 16)}%` }} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="record-actions">
            <button onClick={() => onEdit(weight)} type="button">
              <Pencil aria-hidden size={15} />
              수정
            </button>
            <button onClick={() => onDelete(weight.id)} type="button">
              <Trash2 aria-hidden size={15} />
              삭제
            </button>
          </div>
          <div className="weight-detail-grid">
            <div>
              <span>골격근량</span>
              <strong>{weight.muscleMassKg ? `${weight.muscleMassKg} kg` : "--"}</strong>
            </div>
            <div>
              <span>체지방률</span>
              <strong>{weight.bodyFatPercent ? `${weight.bodyFatPercent}%` : "--"}</strong>
            </div>
          </div>
          {weight.memo ? <p>{weight.memo}</p> : null}
        </>
      ) : (
        <div className="health-empty health-empty--compact">
          <strong>기록 없음</strong>
          <p>이 날짜에 몸무게 기록이 없습니다.</p>
        </div>
      )}
    </SectionCard>
  );
}

function WorkoutSessionCard({ onDelete, onEdit, session }: { onDelete: (id: string) => void; onEdit: (session: WorkoutSession) => void; session: WorkoutSession }) {
  return (
    <article className="workout-session-card">
      <div className="workout-session-card__header">
        <div>
          <Badge tone={session.type === "weight" ? "pink" : "green"}>{workoutTypeLabels[session.type]}</Badge>
          <h3>{workoutTypeLabels[session.type]}</h3>
          <p>{session.durationMinutes}분 · 컨디션 {conditionLabels[session.condition]}</p>
        </div>
        <div className="record-actions">
          <button onClick={() => onEdit(session)} type="button">
            <Pencil aria-hidden size={15} />
            수정
          </button>
          <button onClick={() => onDelete(session.id)} type="button">
            <Trash2 aria-hidden size={15} />
            삭제
          </button>
        </div>
      </div>
      {session.memo ? <p className="workout-session-card__memo">{session.memo}</p> : null}
    </article>
  );
}

function WeightRecordSheet({
  onClose,
  onSave,
  record,
  selectedDate,
}: {
  onClose: () => void;
  onSave: (record: WeightRecord) => void;
  record: WeightRecord | null;
  selectedDate: string;
}) {
  const [date, setDate] = useState(record?.date ?? selectedDate);
  const [weightKg, setWeightKg] = useState(record?.weightKg ? String(record.weightKg) : "");
  const [measuredFasted, setMeasuredFasted] = useState(record?.measuredFasted ?? true);
  const [muscleMassKg, setMuscleMassKg] = useState(record?.muscleMassKg ? String(record.muscleMassKg) : "");
  const [bodyFatPercent, setBodyFatPercent] = useState(record?.bodyFatPercent ? String(record.bodyFatPercent) : "");
  const [memo, setMemo] = useState(record?.memo ?? "");

  const saveRecord = () => {
    const parsedWeight = Number(weightKg);
    if (!parsedWeight) return;

    onSave({
      id: record?.id ?? `weight-${Date.now()}`,
      date,
      weightKg: parsedWeight,
      measuredFasted,
      muscleMassKg: muscleMassKg ? Number(muscleMassKg) : undefined,
      bodyFatPercent: bodyFatPercent ? Number(bodyFatPercent) : undefined,
      memo: memo.trim() || undefined,
    });
  };

  return (
    <HealthSheet title={record ? "몸무게 수정" : "몸무게 기록"} onClose={onClose} onSave={saveRecord}>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>날짜</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="event-form-row event-form-row--field">
          <span>몸무게</span>
          <input inputMode="decimal" placeholder="72.4 kg" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
        </label>
        <div className="event-form-row">
          <div className="event-form-row__label">
            <Scale aria-hidden size={18} />
            <span>공복 측정</span>
          </div>
          <label className="ios-switch">
            <input checked={measuredFasted} type="checkbox" onChange={(event) => setMeasuredFasted(event.target.checked)} />
            <span />
          </label>
        </div>
      </div>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>골격근량</span>
          <input inputMode="decimal" placeholder="선택 입력" value={muscleMassKg} onChange={(event) => setMuscleMassKg(event.target.value)} />
        </label>
        <label className="event-form-row event-form-row--field">
          <span>체지방률</span>
          <input inputMode="decimal" placeholder="선택 입력" value={bodyFatPercent} onChange={(event) => setBodyFatPercent(event.target.value)} />
        </label>
        <label className="event-note">
          <span>메모</span>
          <textarea rows={3} placeholder="측정 시간, 컨디션, 참고사항" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>
      </div>
    </HealthSheet>
  );
}

function WorkoutRecordSheet({
  onClose,
  onSave,
  selectedDate,
  session,
}: {
  onClose: () => void;
  onSave: (session: WorkoutSession) => void;
  selectedDate: string;
  session: WorkoutSession | null;
}) {
  const [date, setDate] = useState(session?.date ?? selectedDate);
  const [type, setType] = useState<WorkoutType>(session?.type ?? "weight");
  const [durationMinutes, setDurationMinutes] = useState(session?.durationMinutes ? String(session.durationMinutes) : "");
  const [condition, setCondition] = useState<WorkoutCondition>(session?.condition ?? "normal");
  const [memo, setMemo] = useState(session?.memo ?? "");

  const saveSession = () => {
    const parsedDuration = Number(durationMinutes);
    if (!parsedDuration) return;

    onSave({
      id: session?.id ?? `workout-${Date.now()}`,
      date,
      type,
      condition,
      durationMinutes: parsedDuration,
      memo: memo.trim() || undefined,
    });
  };

  return (
    <HealthSheet title={session ? "운동 수정" : "운동 기록"} onClose={onClose} onSave={saveSession}>
      <div className="event-form-card event-form-card--title">
        <label>
          <span>메모</span>
          <input autoFocus placeholder="운동 내용, 강도, 특이사항" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </label>
      </div>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>날짜</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="event-form-row event-form-row--select">
          <span>운동 종류</span>
          <select value={type} onChange={(event) => setType(event.target.value as WorkoutType)}>
            <option value="running">러닝</option>
            <option value="stretching">스트레칭</option>
            <option value="bodyweight">맨몸운동</option>
            <option value="weight">웨이트</option>
            <option value="etc">기타</option>
          </select>
        </label>
        <label className="event-form-row event-form-row--field">
          <span>수행시간</span>
          <input inputMode="numeric" placeholder="분 단위" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
        </label>
        <label className="event-form-row event-form-row--select">
          <span>컨디션</span>
          <select value={condition} onChange={(event) => setCondition(event.target.value as WorkoutCondition)}>
            <option value="good">좋음</option>
            <option value="normal">보통</option>
            <option value="low">낮음</option>
          </select>
        </label>
      </div>
    </HealthSheet>
  );
}

function HealthSheet({ children, onClose, onSave, title }: { children: ReactNode; onClose: () => void; onSave: () => void; title: string }) {
  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="health-sheet-title"
        aria-modal="true"
        className="event-sheet health-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose} type="button">취소</button>
          <h2 id="health-sheet-title">{title}</h2>
          <button className="event-sheet__done-button" onClick={onSave} type="button">저장</button>
        </header>
        <div className="event-sheet__body">{children}</div>
        <button className="event-sheet__floating-close" aria-label="닫기" onClick={onClose} type="button">
          <X aria-hidden size={18} />
        </button>
      </section>
    </div>
  );
}
