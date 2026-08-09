"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Activity, Scale } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  createWeightRecordInDb,
  createWorkoutSessionInDb,
  deleteWeightRecordFromDb,
  deleteWorkoutSessionFromDb,
  updateWeightRecordInDb,
  updateWorkoutSessionInDb,
} from "@/features/health/api";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatRunDuration } from "@/features/life/reconstruction";
import type { WeightRecord, WorkoutSession } from "@/types/domain";

export function LifeHealthView({
  setWeights,
  setWorkouts,
  weights,
  workouts,
}: {
  setWeights: Dispatch<SetStateAction<WeightRecord[]>>;
  setWorkouts: Dispatch<SetStateAction<WorkoutSession[]>>;
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [isRunningEditorOpen, setIsRunningEditorOpen] = useState(false);
  const [isWeightEditorOpen, setIsWeightEditorOpen] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [deletingWeightId, setDeletingWeightId] = useState<string | null>(null);
  const [isSavingRunning, setIsSavingRunning] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [message, setMessage] = useState("");

  const selectedRuns = workouts.filter((workout) => workout.date === date && workout.type === "running");
  const selectedWeight = weights.find((weight) => weight.date === date);
  const totalDistanceKm = selectedRuns.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  const totalSeconds = selectedRuns.reduce((sum, workout) => sum + (workout.durationSeconds ?? workout.durationMinutes * 60), 0);

  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    setDistanceKm("");
    setDurationMinutes("");
    setDurationSeconds("");
    setWeightKg("");
    setEditingRunId(null);
    setIsRunningEditorOpen(false);
    setIsWeightEditorOpen(false);
  };

  const saveRunning = async () => {
    const parsedDistance = Number(distanceKm);
    const parsedMinutes = Number(durationMinutes) || 0;
    const parsedSeconds = Number(durationSeconds) || 0;
    const parsedTotalSeconds = parsedMinutes * 60 + parsedSeconds;
    if (!parsedDistance || parsedTotalSeconds <= 0) return;

    setIsSavingRunning(true);
    try {
      const nextRun = {
        id: editingRunId ?? `run-${Date.now()}`,
        date,
        type: "running",
        condition: "normal",
        durationMinutes: Math.max(1, Math.ceil(parsedTotalSeconds / 60)),
        durationSeconds: parsedTotalSeconds,
        distanceKm: parsedDistance,
      } satisfies WorkoutSession;
      const savedRun = editingRunId ? await updateWorkoutSessionInDb(nextRun) : await createWorkoutSessionInDb(nextRun);
      if (savedRun) setWorkouts((current) => [savedRun, ...current.filter((workout) => workout.id !== savedRun.id)]);
      setDistanceKm("");
      setDurationMinutes("");
      setDurationSeconds("");
      setEditingRunId(null);
      setIsRunningEditorOpen(false);
      setMessage(editingRunId ? "러닝 기록을 수정했어요." : "러닝 기록을 저장했어요.");
    } finally {
      setIsSavingRunning(false);
    }
  };

  const editRunning = (run: WorkoutSession) => {
    const totalDurationSeconds = run.durationSeconds ?? run.durationMinutes * 60;
    setDate(run.date);
    setDistanceKm(run.distanceKm ? String(run.distanceKm) : "");
    setDurationMinutes(String(Math.floor(totalDurationSeconds / 60)));
    setDurationSeconds(String(totalDurationSeconds % 60));
    setEditingRunId(run.id);
    setIsRunningEditorOpen(true);
  };

  const deleteRunning = async (id: string) => {
    setDeletingRunId(id);
    try {
      await deleteWorkoutSessionFromDb(id);
      setWorkouts((current) => current.filter((workout) => workout.id !== id));
      if (editingRunId === id) {
        setEditingRunId(null);
        setDistanceKm("");
        setDurationMinutes("");
        setDurationSeconds("");
        setIsRunningEditorOpen(false);
      }
      setMessage("러닝 기록을 삭제했어요.");
    } finally {
      setDeletingRunId(null);
    }
  };

  const saveMorningWeight = async () => {
    const parsedWeight = Number(weightKg);
    if (!parsedWeight) return;

    setIsSavingWeight(true);
    try {
      const nextWeight = {
        id: selectedWeight?.id ?? `weight-${Date.now()}`,
        date,
        weightKg: parsedWeight,
        measuredFasted: true,
        memo: "아침 몸무게",
      };
      const savedWeight = selectedWeight ? await updateWeightRecordInDb(nextWeight) : await createWeightRecordInDb(nextWeight);
      if (savedWeight) setWeights((current) => [savedWeight, ...current.filter((weight) => weight.id !== savedWeight.id && weight.date !== savedWeight.date)]);
      setWeightKg("");
      setIsWeightEditorOpen(false);
      setMessage("아침 몸무게를 저장했어요.");
    } finally {
      setIsSavingWeight(false);
    }
  };

  const editMorningWeight = () => {
    setWeightKg(selectedWeight ? String(selectedWeight.weightKg) : "");
    setIsWeightEditorOpen(true);
  };

  const deleteMorningWeight = async () => {
    if (!selectedWeight) return;

    setDeletingWeightId(selectedWeight.id);
    try {
      await deleteWeightRecordFromDb(selectedWeight.id);
      setWeights((current) => current.filter((weight) => weight.id !== selectedWeight.id));
      setWeightKg("");
      setIsWeightEditorOpen(false);
      setMessage("아침 몸무게 기록을 삭제했어요.");
    } finally {
      setDeletingWeightId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="건강" description="러닝과 아침 몸무게를 저장하면 건강 축과 라이프 캘린더 기간 기록에 함께 반영됩니다." />
      <div className="life-health-view">
        <SectionCard className="life-capture-list life-health-summary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <label className="life-health-date-control">
              <span>기록 날짜</span>
              <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
            </label>
          </div>
          <div className="life-health-sections">
            <section className="life-health-section">
              <div className="life-health-section__head">
                <div>
                  <Activity aria-hidden size={17} />
                  <span>러닝 기록</span>
                </div>
                <button className={isRunningEditorOpen ? "life-section-save" : "life-section-edit"} disabled={isRunningEditorOpen && (!distanceKm || (!durationMinutes && !durationSeconds) || isSavingRunning)} onClick={() => (isRunningEditorOpen ? void saveRunning() : setIsRunningEditorOpen(true))} type="button">
                  {isSavingRunning ? "저장 중" : isRunningEditorOpen ? "저장" : selectedRuns.length > 0 ? "추가/수정" : "추가"}
                </button>
              </div>
              {isRunningEditorOpen ? (
                <div className="life-health-editor">
                  <div className="life-health-fields">
                    <label>
                      <span>거리</span>
                      <input inputMode="decimal" min="0" placeholder="km" type="number" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
                    </label>
                    <label>
                      <span>시간</span>
                      <input inputMode="numeric" min="0" placeholder="분" type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
                    </label>
                    <label>
                      <span>초</span>
                      <input inputMode="numeric" max="59" min="0" placeholder="초" type="number" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} />
                    </label>
                  </div>
                  <button
                    className="life-capture-secondary"
                    onClick={() => {
                      setEditingRunId(null);
                      setIsRunningEditorOpen(false);
                      setDistanceKm("");
                      setDurationMinutes("");
                      setDurationSeconds("");
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="life-health-summary-grid life-health-summary-grid--single">
                  <article>
                    <span>러닝</span>
                    <strong>{selectedRuns.length > 0 ? `${totalDistanceKm.toFixed(1)}km` : "-"}</strong>
                    <p>{selectedRuns.length > 0 ? `${selectedRuns.length}회 · ${formatRunDuration(totalSeconds)}` : "러닝 기록이 없습니다."}</p>
                  </article>
                </div>
              )}
              {selectedRuns.length > 0 ? (
                <div className="life-health-run-list">
                  {selectedRuns.map((run) => (
                    <article key={run.id}>
                      <div>
                        <strong>{run.distanceKm ? `${run.distanceKm}km` : "거리 미기록"}</strong>
                        <span>{formatRunDuration(run.durationSeconds ?? run.durationMinutes * 60)}</span>
                      </div>
                      <div className="life-record-actions">
                        <button onClick={() => editRunning(run)} type="button">
                          수정
                        </button>
                        <button disabled={deletingRunId === run.id} onClick={() => void deleteRunning(run.id)} type="button">
                          {deletingRunId === run.id ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="life-health-section">
              <div className="life-health-section__head">
                <div>
                  <Scale aria-hidden size={17} />
                  <span>아침 몸무게</span>
                </div>
                <button className={isWeightEditorOpen ? "life-section-save" : "life-section-edit"} disabled={isWeightEditorOpen && (!weightKg || isSavingWeight)} onClick={() => (isWeightEditorOpen ? void saveMorningWeight() : editMorningWeight())} type="button">
                  {isSavingWeight ? "저장 중" : isWeightEditorOpen ? "저장" : selectedWeight ? "수정" : "추가"}
                </button>
              </div>
              {isWeightEditorOpen ? (
                <div className="life-health-editor">
                  <label className="life-health-weight-field">
                    <span>몸무게</span>
                    <input inputMode="decimal" min="0" placeholder="kg" type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                  </label>
                  <button
                    className="life-capture-secondary"
                    onClick={() => {
                      setIsWeightEditorOpen(false);
                      setWeightKg("");
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="life-health-summary-grid life-health-summary-grid--single">
                  <article>
                    <span>아침 몸무게</span>
                    <strong>{selectedWeight ? `${selectedWeight.weightKg}kg` : "-"}</strong>
                    <p>{selectedWeight ? "공복 기준으로 저장된 기록입니다." : "아침 몸무게 기록이 없습니다."}</p>
                  </article>
                </div>
              )}
              {selectedWeight ? (
                <div className="life-record-actions life-record-actions--inline">
                  <button disabled={deletingWeightId === selectedWeight.id} onClick={() => void deleteMorningWeight()} type="button">
                    {deletingWeightId === selectedWeight.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
          {message ? <p className="life-health-message">{message}</p> : null}
        </SectionCard>
      </div>
    </div>
  );
}
