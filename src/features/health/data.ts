import type { WeightRecord, WorkoutSession } from "@/types/domain";

export const weightRecords: WeightRecord[] = [
  {
    id: "weight-1",
    date: "2026-05-12",
    weightKg: 72.4,
    measuredFasted: true,
    muscleMassKg: 34.8,
    bodyFatPercent: 18.5,
    memo: "수면 6시간, 컨디션 보통",
  },
  {
    id: "weight-2",
    date: "2026-05-11",
    weightKg: 72.8,
    measuredFasted: true,
    muscleMassKg: 34.7,
    bodyFatPercent: 18.7,
  },
  {
    id: "weight-3",
    date: "2026-05-10",
    weightKg: 73.1,
    measuredFasted: false,
  },
];

export const workoutSessions: WorkoutSession[] = [
  {
    id: "workout-1",
    date: "2026-05-12",
    type: "weight",
    condition: "normal",
    durationMinutes: 52,
    memo: "가슴/어깨 중심. 벤치프레스와 숄더프레스 진행.",
  },
  {
    id: "workout-2",
    date: "2026-05-12",
    type: "running",
    condition: "good",
    durationMinutes: 24,
    memo: "3.2km 정도 가볍게 러닝. 페이스 안정적.",
  },
];
