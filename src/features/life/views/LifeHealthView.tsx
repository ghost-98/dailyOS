"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Activity, Pencil, Scale, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
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
import { confirmAction } from "@/lib/actionGuards";
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
    if (!confirmAction(editingRunId ? "러닝 기록 수정을 저장할까요?" : "러닝 기록을 저장할까요?")) return;

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
    if (!confirmAction("이 러닝 기록을 삭제할까요?")) return;
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
    if (!confirmAction(selectedWeight ? "체중 수정을 저장할까요?" : "체중을 저장할까요?")) return;

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
    if (!confirmAction("이 체중 기록을 삭제할까요?")) return;

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
      <div className="life-health-view ui-workspace-stack">
        <SectionCard className="life-capture-list life-health-summary ui-workspace-panel">
          <div className="section-heading ui-panel-heading ui-panel-heading--compact">
            <div className="ui-panel-heading__intro">
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <label className="life-health-date-control ui-panel-heading__meta">
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
                <ActionButton
                  disabled={isRunningEditorOpen && (!distanceKm || (!durationMinutes && !durationSeconds) || isSavingRunning)}
                  onClick={() => (isRunningEditorOpen ? void saveRunning() : setIsRunningEditorOpen(true))}
                  variant={isRunningEditorOpen ? "primary" : "secondary"}
                >
                  {isSavingRunning ? "저장 중" : isRunningEditorOpen ? "저장" : selectedRuns.length > 0 ? "추가/수정" : "추가"}
                </ActionButton>
              </div>
              {isRunningEditorOpen ? (
                <div className="life-health-editor">
                  <div className="ui-form-grid ui-form-grid--columns-3">
                    <FormField label="거리">
                      <input inputMode="decimal" min="0" placeholder="km" type="number" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
                    </FormField>
                    <FormField label="시간">
                      <input inputMode="numeric" min="0" placeholder="분" type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
                    </FormField>
                    <FormField label="초">
                      <input inputMode="numeric" max="59" min="0" placeholder="초" type="number" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} />
                    </FormField>
                  </div>
                  <ActionButton
                    onClick={() => {
                      setEditingRunId(null);
                      setIsRunningEditorOpen(false);
                      setDistanceKm("");
                      setDurationMinutes("");
                      setDurationSeconds("");
                    }}
                    variant="secondary"
                  >
                    취소
                  </ActionButton>
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
                        <IconButton label="러닝 수정" onClick={() => editRunning(run)} size="sm" tone="soft">
                          <Pencil aria-hidden size={14} />
                        </IconButton>
                        <IconButton disabled={deletingRunId === run.id} label="러닝 삭제" onClick={() => void deleteRunning(run.id)} size="sm" tone="danger">
                          <Trash2 aria-hidden size={14} />
                        </IconButton>
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
                <ActionButton
                  disabled={isWeightEditorOpen && (!weightKg || isSavingWeight)}
                  onClick={() => (isWeightEditorOpen ? void saveMorningWeight() : editMorningWeight())}
                  variant={isWeightEditorOpen ? "primary" : "secondary"}
                >
                  {isSavingWeight ? "저장 중" : isWeightEditorOpen ? "저장" : selectedWeight ? "수정" : "추가"}
                </ActionButton>
              </div>
              {isWeightEditorOpen ? (
                <div className="life-health-editor">
                  <FormField className="life-health-weight-field" label="몸무게">
                    <input inputMode="decimal" min="0" placeholder="kg" type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                  </FormField>
                  <ActionButton
                    onClick={() => {
                      setIsWeightEditorOpen(false);
                      setWeightKg("");
                    }}
                    variant="secondary"
                  >
                    취소
                  </ActionButton>
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
                  <IconButton disabled={deletingWeightId === selectedWeight.id} label="체중 삭제" onClick={() => void deleteMorningWeight()} size="sm" tone="danger">
                    <Trash2 aria-hidden size={14} />
                  </IconButton>
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
