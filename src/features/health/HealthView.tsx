"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, Plus, Scale, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { WeightRecord, WorkoutCondition, WorkoutSession, WorkoutType } from "@/types/domain";
import { weightRecords, workoutSessions } from "./data";

const initialDate = "2026-05-12";

const workoutTypeLabels: Record<WorkoutType, string> = {
  strength: "근력",
  cardio: "유산소",
  stretching: "스트레칭",
  sports: "스포츠",
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

function groupSetsByExercise(session: WorkoutSession) {
  return Object.values(
    session.sets.reduce<Record<string, { exerciseName: string; bodyPart: string; sets: typeof session.sets }>>((groups, set) => {
      groups[set.exerciseName] ??= { exerciseName: set.exerciseName, bodyPart: set.bodyPart, sets: [] };
      groups[set.exerciseName].sets.push(set);
      return groups;
    }, {}),
  );
}

export function HealthView() {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sheetType, setSheetType] = useState<"weight" | "workout" | null>(null);
  const weight = useMemo(() => weightRecords.find((record) => record.date === selectedDate), [selectedDate]);
  const sessions = useMemo(() => workoutSessions.filter((session) => session.date === selectedDate), [selectedDate]);
  const totalSets = sessions.reduce((sum, session) => sum + session.sets.length, 0);
  const totalMinutes = sessions.reduce((sum, session) => {
    if (!session.startsAt || !session.endsAt) return sum;
    const start = Number(session.startsAt.slice(0, 2)) * 60 + Number(session.startsAt.slice(3, 5));
    const end = Number(session.endsAt.slice(0, 2)) * 60 + Number(session.endsAt.slice(3, 5));
    return sum + Math.max(end - start, 0);
  }, 0);

  return (
    <div className="health-page">
      <header className="health-header page-header">
        <div>
          <h1>건강</h1>
          <div className="today__date">
            <HeartPulse aria-hidden size={20} />
            <span>날짜별 몸무게와 운동 세션을 함께 기록합니다.</span>
          </div>
        </div>
        <div className="health-actions">
          <button className="header-action" onClick={() => setSheetType("weight")}>
            <Scale aria-hidden size={18} />
            몸무게 기록
          </button>
          <button className="header-action" onClick={() => setSheetType("workout")}>
            <Plus aria-hidden size={18} />
            운동 기록
          </button>
        </div>
      </header>

      <SectionCard className="task-day-switcher">
        <button aria-label="이전 날짜" onClick={() => setSelectedDate((date) => addDays(date, -1))}>
          <ChevronLeft aria-hidden size={20} />
        </button>
        <button className="task-date-trigger">{formatSelectedDay(selectedDate)}</button>
        <button aria-label="다음 날짜" onClick={() => setSelectedDate((date) => addDays(date, 1))}>
          <ChevronRight aria-hidden size={20} />
        </button>
      </SectionCard>

      <div className="health-summary-grid">
        <WeightCard weight={weight} />
        <SectionCard className="health-metric-card">
          <span>운동 세션</span>
          <strong>{sessions.length}</strong>
          <p>{totalSets}세트 · {totalMinutes}분 기록</p>
        </SectionCard>
        <SectionCard className="health-metric-card">
          <span>최근 추이</span>
          <strong>{weight ? `${weight.weightKg}kg` : "--"}</strong>
          <div className="weight-sparkline" aria-hidden>
            {weightRecords.map((record) => (
              <span key={record.id} style={{ height: `${Math.max(20, 100 - (record.weightKg - 70) * 16)}%` }} />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard className="workout-section">
        <div className="section-heading">
          <div className="card-title">
            <Dumbbell aria-hidden size={20} />
            <span>운동 세션</span>
          </div>
          <button>이전 루틴 복사</button>
        </div>

        <div className="workout-session-list">
          {sessions.length > 0 ? sessions.map((session) => <WorkoutSessionCard key={session.id} session={session} />) : (
            <div className="health-empty">
              <Activity aria-hidden size={24} />
              <strong>운동 기록이 없습니다.</strong>
              <p>운동 기록 버튼으로 오늘 세션을 남겨보세요.</p>
            </div>
          )}
        </div>
      </SectionCard>

      {sheetType === "weight" ? <WeightRecordSheet selectedDate={selectedDate} onClose={() => setSheetType(null)} /> : null}
      {sheetType === "workout" ? <WorkoutRecordSheet selectedDate={selectedDate} onClose={() => setSheetType(null)} /> : null}
    </div>
  );
}

function WeightCard({ weight }: { weight?: WeightRecord }) {
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
          <p>이 날짜의 몸무게 기록이 없습니다.</p>
        </div>
      )}
    </SectionCard>
  );
}

function WorkoutSessionCard({ session }: { session: WorkoutSession }) {
  const groupedSets = groupSetsByExercise(session);

  return (
    <article className="workout-session-card">
      <div className="workout-session-card__header">
        <div>
          <Badge tone={session.type === "strength" ? "pink" : "green"}>{workoutTypeLabels[session.type]}</Badge>
          <h3>{session.title}</h3>
          <p>{session.startsAt && session.endsAt ? `${session.startsAt} - ${session.endsAt}` : "시간 미기록"} · 컨디션 {conditionLabels[session.condition]}</p>
        </div>
        <button>세트 추가</button>
      </div>

      <div className="exercise-group-list">
        {groupedSets.map((group) => (
          <div className="exercise-group" key={group.exerciseName}>
            <div className="exercise-group__title">
              <strong>{group.exerciseName}</strong>
              <span>{group.bodyPart}</span>
            </div>
            <div className="set-list">
              {group.sets.map((set) => (
                <div className="set-row" key={set.id}>
                  <span>{set.order}세트</span>
                  <strong>
                    {set.weightKg ? `${set.weightKg}kg` : ""}
                    {set.weightKg && set.reps ? " x " : ""}
                    {set.reps ? `${set.reps}회` : ""}
                    {set.distanceKm ? `${set.distanceKm}km` : ""}
                    {set.durationMinutes ? ` · ${set.durationMinutes}분` : ""}
                  </strong>
                  {set.memo ? <small>{set.memo}</small> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {session.memo ? <p className="workout-session-card__memo">{session.memo}</p> : null}
    </article>
  );
}

function WeightRecordSheet({ selectedDate, onClose }: { selectedDate: string; onClose: () => void }) {
  return (
    <HealthSheet title="몸무게 기록" onClose={onClose}>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>날짜</span>
          <input type="date" defaultValue={selectedDate} />
        </label>
        <label className="event-form-row event-form-row--field">
          <span>몸무게</span>
          <input inputMode="decimal" placeholder="72.4 kg" />
        </label>
        <div className="event-form-row">
          <div className="event-form-row__label">
            <Scale aria-hidden size={18} />
            <span>공복 측정</span>
          </div>
          <label className="ios-switch">
            <input type="checkbox" defaultChecked />
            <span />
          </label>
        </div>
      </div>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>골격근량</span>
          <input inputMode="decimal" placeholder="선택 입력" />
        </label>
        <label className="event-form-row event-form-row--field">
          <span>체지방률</span>
          <input inputMode="decimal" placeholder="선택 입력" />
        </label>
        <label className="event-note">
          <span>메모</span>
          <textarea rows={3} placeholder="수면, 식사, 컨디션 메모" />
        </label>
      </div>
    </HealthSheet>
  );
}

function WorkoutRecordSheet({ selectedDate, onClose }: { selectedDate: string; onClose: () => void }) {
  return (
    <HealthSheet title="운동 기록" onClose={onClose}>
      <div className="event-form-card event-form-card--title">
        <label>
          <span>세션명</span>
          <input autoFocus placeholder="상체 근력, 러닝, 하체 운동..." />
        </label>
        <label>
          <span>메모</span>
          <input placeholder="오늘 운동의 핵심 메모" />
        </label>
      </div>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>날짜</span>
          <input type="date" defaultValue={selectedDate} />
        </label>
        <label className="event-form-row event-form-row--select">
          <span>운동 종류</span>
          <select defaultValue="strength">
            <option value="strength">근력</option>
            <option value="cardio">유산소</option>
            <option value="stretching">스트레칭</option>
            <option value="sports">스포츠</option>
            <option value="etc">기타</option>
          </select>
        </label>
        <label className="event-form-row event-form-row--select">
          <span>컨디션</span>
          <select defaultValue="normal">
            <option value="good">좋음</option>
            <option value="normal">보통</option>
            <option value="low">낮음</option>
          </select>
        </label>
      </div>
      <div className="event-form-card">
        <label className="event-form-row event-form-row--field">
          <span>운동명</span>
          <input placeholder="벤치프레스" />
        </label>
        <label className="event-form-row event-form-row--field">
          <span>부위</span>
          <input placeholder="가슴, 등, 유산소..." />
        </label>
        <label className="event-form-row event-form-row--field">
          <span>1세트</span>
          <input placeholder="40kg x 12회 또는 3km · 20분" />
        </label>
      </div>
    </HealthSheet>
  );
}

function HealthSheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
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
          <button className="event-sheet__text-button" onClick={onClose}>취소</button>
          <h2 id="health-sheet-title">{title}</h2>
          <button className="event-sheet__done-button" onClick={onClose}>저장</button>
        </header>
        <div className="event-sheet__body">{children}</div>
        <button className="event-sheet__floating-close" aria-label="닫기" onClick={onClose}>
          <X aria-hidden size={18} />
        </button>
      </section>
    </div>
  );
}
