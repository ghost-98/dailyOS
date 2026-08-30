"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Activity, Pencil, Scale, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { MobileRecordFrame } from "@/features/life/components/MobileRecordFrame";
import { MobileRecordSheet } from "@/features/life/components/MobileRecordSheet";
import { RecordMonthCalendar } from "@/features/life/components/RecordMonthCalendar";
import {
  createWeightRecordInDb,
  createWorkoutSessionInDb,
  deleteWeightRecordFromDb,
  deleteWorkoutSessionFromDb,
  updateWeightRecordInDb,
  updateWorkoutSessionInDb,
} from "@/features/health/api";
import { formatDateKey, formatFullDate } from "@/features/life/dateTime";
import { createMonthCursor, shiftLifeDateKey } from "@/features/life/activityHelpers";
import { formatRunDuration, formatWeightMeasurementMeta } from "@/features/life/formatters";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
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
  const [measuredAtTime, setMeasuredAtTime] = useState("");
  const [measuredFasted, setMeasuredFasted] = useState(true);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [isRunningEditorOpen, setIsRunningEditorOpen] = useState(false);
  const [isWeightEditorOpen, setIsWeightEditorOpen] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [deletingWeightId, setDeletingWeightId] = useState<string | null>(null);
  const [isSavingRunning, setIsSavingRunning] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [message, setMessage] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => createMonthCursor(date));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"running" | "weight">("running");
  const { isMobile, isReady } = useResponsiveMode();

  const selectedRuns = workouts.filter((workout) => workout.date === date && workout.type === "running");
  const selectedRun = selectedRuns[0] ?? null;
  const selectedWeight = weights.find((weight) => weight.date === date);
  const healthCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workout of workouts) counts.set(workout.date, (counts.get(workout.date) ?? 0) + 1);
    for (const weight of weights) counts.set(weight.date, (counts.get(weight.date) ?? 0) + 1);
    return counts;
  }, [weights, workouts]);
  const totalDistanceKm = selectedRuns.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);

  if (!isReady) {
    return <div className="life-health-view life-health-view--pending" aria-hidden />;
  }

  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    setMonthCursor(createMonthCursor(nextDate));
    setDistanceKm("");
    setDurationMinutes("");
    setDurationSeconds("");
    setWeightKg("");
    setMeasuredAtTime("");
    setMeasuredFasted(true);
    setEditingRunId(null);
    setIsRunningEditorOpen(false);
    setIsWeightEditorOpen(false);
    setIsComposerOpen(false);
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
      setIsComposerOpen(false);
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
    setComposerMode("running");
    setIsComposerOpen(true);
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
    if (!parsedWeight || !measuredAtTime) return;
    if (!confirmAction(selectedWeight ? "체중 수정을 저장할까요?" : "체중을 저장할까요?")) return;

    setIsSavingWeight(true);
    try {
      const nextWeight = {
        id: selectedWeight?.id ?? `weight-${Date.now()}`,
        date,
        weightKg: parsedWeight,
        measuredAtTime,
        measuredFasted,
        memo: "아침 몸무게",
      };
      const savedWeight = selectedWeight ? await updateWeightRecordInDb(nextWeight) : await createWeightRecordInDb(nextWeight);
      if (savedWeight) setWeights((current) => [savedWeight, ...current.filter((weight) => weight.id !== savedWeight.id && weight.date !== savedWeight.date)]);
      setWeightKg("");
      setMeasuredAtTime("");
      setMeasuredFasted(true);
      setIsWeightEditorOpen(false);
      setIsComposerOpen(false);
      setMessage("아침 몸무게를 저장했어요.");
    } finally {
      setIsSavingWeight(false);
    }
  };

  const editMorningWeight = () => {
    setWeightKg(selectedWeight ? String(selectedWeight.weightKg) : "");
    setMeasuredAtTime(selectedWeight?.measuredAtTime ?? "");
    setMeasuredFasted(selectedWeight?.measuredFasted ?? true);
    setIsWeightEditorOpen(true);
    setComposerMode("weight");
    setIsComposerOpen(true);
  };

  const openHealthComposer = (mode: "running" | "weight" = "running") => {
    setComposerMode(mode);
    setEditingRunId(null);
    setDistanceKm("");
    setDurationMinutes("");
    setDurationSeconds("");
    setWeightKg(mode === "weight" && selectedWeight ? String(selectedWeight.weightKg) : "");
    setMeasuredAtTime(mode === "weight" ? selectedWeight?.measuredAtTime ?? "" : "");
    setMeasuredFasted(mode === "weight" ? selectedWeight?.measuredFasted ?? true : true);
    setIsRunningEditorOpen(false);
    setIsWeightEditorOpen(false);
    setIsComposerOpen(true);
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

  const desktopHealthContent = (
    <div className="life-tab-panel">
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
              ) : selectedRuns.length > 0 ? (
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
                  disabled={isWeightEditorOpen && (!weightKg || !measuredAtTime || isSavingWeight)}
                  onClick={() => (isWeightEditorOpen ? void saveMorningWeight() : editMorningWeight())}
                  variant={isWeightEditorOpen ? "primary" : "secondary"}
                >
                  {isSavingWeight ? "저장 중" : isWeightEditorOpen ? "저장" : selectedWeight ? "수정" : "추가"}
                </ActionButton>
              </div>
              {isWeightEditorOpen ? (
                <div className="life-health-editor">
                  <div className="ui-form-grid ui-form-grid--columns-2">
                    <FormField className="life-health-weight-field" label="몸무게">
                      <input inputMode="decimal" min="0" placeholder="kg" type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                    </FormField>
                    <FormField label="측정 시간">
                      <input type="time" value={measuredAtTime} onChange={(event) => setMeasuredAtTime(event.target.value)} />
                    </FormField>
                  </div>
                  <FormField label="공복 여부">
                    <label className="planner-option-toggle">
                      <input checked={measuredFasted} type="checkbox" onChange={(event) => setMeasuredFasted(event.target.checked)} />
                      <span>6시간 이상 공복</span>
                    </label>
                  </FormField>
                  <ActionButton
                    onClick={() => {
                      setIsWeightEditorOpen(false);
                      setWeightKg("");
                      setMeasuredAtTime("");
                      setMeasuredFasted(true);
                    }}
                    variant="secondary"
                  >
                    취소
                  </ActionButton>
                </div>
              ) : (
                <div className="life-health-entry-row">
                  <div>
                    <strong>{selectedWeight ? `${selectedWeight.weightKg}kg` : "-"}</strong>
                    <span>{selectedWeight ? formatWeightMeasurementMeta(selectedWeight.measuredAtTime, selectedWeight.measuredFasted) : "아침 몸무게 기록이 없습니다."}</span>
                  </div>
                  {selectedWeight ? (
                    <div className="life-record-actions">
                      <IconButton label="몸무게 수정" onClick={() => editMorningWeight()} size="sm" tone="soft">
                        <Pencil aria-hidden size={14} />
                      </IconButton>
                      <IconButton disabled={deletingWeightId === selectedWeight.id} label="체중 삭제" onClick={() => void deleteMorningWeight()} size="sm" tone="danger">
                        <Trash2 aria-hidden size={14} />
                      </IconButton>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>
          {message ? <p className="life-health-message">{message}</p> : null}
        </SectionCard>
      </div>
    </div>
  );

  return isMobile ? (
    <MobileRecordFrame
      addButtonLabel="건강 추가"
      calendar={
        <RecordMonthCalendar
          countsByDate={healthCountsByDate}
          monthCursor={monthCursor}
          onNextMonth={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          onPrevMonth={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          onSelectDate={changeDate}
          selectedDate={date}
        />
      }
      countLabel="건강 기록"
      countValue={`${(selectedRuns.length > 0 ? 1 : 0) + (selectedWeight ? 1 : 0)}개`}
      dateLabel={formatFullDate(date)}
      dateSubLabel={`${selectedRuns.length}회 러닝 · ${selectedWeight ? "체중 있음" : "체중 없음"}`}
      isCalendarOpen={isCalendarOpen}
      onAddClick={openHealthComposer}
      onNextDate={() => changeDate(shiftLifeDateKey(date, 1))}
      onPrevDate={() => changeDate(shiftLifeDateKey(date, -1))}
      onToggleCalendar={() => setIsCalendarOpen((current) => !current)}
      summary={
        <div className="life-health-mobile-summary">
          <article>
            <div className="life-health-mobile-summary__head">
              <span>러닝</span>
              {selectedRun ? (
                <div className="life-record-actions">
                  <IconButton label="러닝 수정" onClick={() => editRunning(selectedRun)} size="sm" tone="soft">
                    <Pencil aria-hidden size={14} />
                  </IconButton>
                  <IconButton disabled={deletingRunId === selectedRun.id} label="러닝 삭제" onClick={() => void deleteRunning(selectedRun.id)} size="sm" tone="danger">
                    <Trash2 aria-hidden size={14} />
                  </IconButton>
                </div>
              ) : null}
            </div>
            <strong>{selectedRuns.length > 0 ? `${totalDistanceKm.toFixed(1)}km` : "-"}</strong>
            <span>{selectedRuns.length > 0 ? `${selectedRuns.length}회` : "기록 없음"}</span>
          </article>
          <article>
            <div className="life-health-mobile-summary__head">
              <span>몸무게</span>
              {selectedWeight ? (
                <div className="life-record-actions">
                  <IconButton label="몸무게 수정" onClick={editMorningWeight} size="sm" tone="soft">
                    <Pencil aria-hidden size={14} />
                  </IconButton>
                  <IconButton disabled={deletingWeightId === selectedWeight.id} label="체중 삭제" onClick={() => void deleteMorningWeight()} size="sm" tone="danger">
                    <Trash2 aria-hidden size={14} />
                  </IconButton>
                </div>
              ) : null}
            </div>
            <strong>{selectedWeight ? `${selectedWeight.weightKg}kg` : "-"}</strong>
            <span>{selectedWeight ? formatWeightMeasurementMeta(selectedWeight.measuredAtTime, selectedWeight.measuredFasted) : "-"}</span>
          </article>
        </div>
      }
    >
      {message ? <p className="life-health-message">{message}</p> : null}
      {isComposerOpen ? (
        <MobileRecordSheet
          className="life-health-mobile-composer life-capture-editor life-capture-editor--mobile"
          description={formatFullDate(date)}
          onClose={() => {
            setIsComposerOpen(false);
            setDistanceKm("");
            setDurationMinutes("");
            setDurationSeconds("");
            setWeightKg("");
            setMeasuredAtTime("");
            setMeasuredFasted(true);
            setEditingRunId(null);
            setIsRunningEditorOpen(false);
            setIsWeightEditorOpen(false);
          }}
          title={composerMode === "running" ? "러닝 기록 추가" : "아침 몸무게 추가"}
        >
          <div className="mobile-record-frame__menu-list life-health-composer__switcher">
            <button
              className={composerMode === "running" ? "life-health-composer__switcher-item life-health-composer__switcher-item--active" : "life-health-composer__switcher-item"}
              onClick={() => setComposerMode("running")}
              type="button"
            >
              <Activity aria-hidden size={15} />
              <span>러닝 기록</span>
            </button>
            <button
              className={composerMode === "weight" ? "life-health-composer__switcher-item life-health-composer__switcher-item--active" : "life-health-composer__switcher-item"}
              onClick={() => setComposerMode("weight")}
              type="button"
            >
              <Scale aria-hidden size={15} />
              <span>아침 몸무게</span>
            </button>
          </div>
          {composerMode === "running" ? (
            <>
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
              <div className="ui-form-actions">
                <ActionButton
                  onClick={() => {
                    setIsComposerOpen(false);
                    setDistanceKm("");
                    setDurationMinutes("");
                    setDurationSeconds("");
                  }}
                  variant="secondary"
                >
                  취소
                </ActionButton>
                <ActionButton disabled={!distanceKm || (!durationMinutes && !durationSeconds) || isSavingRunning} onClick={saveRunning}>
                  {isSavingRunning ? "저장 중..." : editingRunId ? "러닝 수정" : "러닝 저장"}
                </ActionButton>
              </div>
            </>
          ) : (
            <>
              <FormField className="life-health-weight-field" label="몸무게">
                <input inputMode="decimal" min="0" placeholder="kg" type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
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
              <div className="ui-form-actions">
                <ActionButton
                  onClick={() => {
                    setIsComposerOpen(false);
                    setWeightKg("");
                    setMeasuredAtTime("");
                    setMeasuredFasted(true);
                  }}
                  variant="secondary"
                >
                  취소
                </ActionButton>
                <ActionButton disabled={!weightKg || !measuredAtTime || isSavingWeight} onClick={saveMorningWeight}>
                  {isSavingWeight ? "저장 중..." : selectedWeight ? "몸무게 수정" : "몸무게 저장"}
                </ActionButton>
              </div>
            </>
          )}
          {message ? <p className="life-health-message">{message}</p> : null}
        </MobileRecordSheet>
      ) : null}
    </MobileRecordFrame>
  ) : (
    desktopHealthContent
  );
}
