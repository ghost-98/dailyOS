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
    title: "상체 근력 트레이닝",
    type: "strength",
    condition: "normal",
    startsAt: "20:00",
    endsAt: "20:52",
    memo: "가슴/어깨 중심. 마지막 세트는 RPE 높음.",
    sets: [
      {
        id: "set-1",
        order: 1,
        exerciseName: "벤치프레스",
        bodyPart: "가슴",
        weightKg: 40,
        reps: 12,
      },
      {
        id: "set-2",
        order: 2,
        exerciseName: "벤치프레스",
        bodyPart: "가슴",
        weightKg: 50,
        reps: 10,
      },
      {
        id: "set-3",
        order: 3,
        exerciseName: "벤치프레스",
        bodyPart: "가슴",
        weightKg: 55,
        reps: 8,
      },
      {
        id: "set-4",
        order: 1,
        exerciseName: "숄더프레스",
        bodyPart: "어깨",
        weightKg: 20,
        reps: 12,
      },
      {
        id: "set-5",
        order: 2,
        exerciseName: "숄더프레스",
        bodyPart: "어깨",
        weightKg: 25,
        reps: 10,
      },
    ],
  },
  {
    id: "workout-2",
    date: "2026-05-12",
    title: "가벼운 러닝",
    type: "cardio",
    condition: "good",
    startsAt: "07:10",
    endsAt: "07:34",
    sets: [
      {
        id: "set-6",
        order: 1,
        exerciseName: "러닝",
        bodyPart: "유산소",
        distanceKm: 3.2,
        durationMinutes: 24,
        memo: "페이스 안정적",
      },
    ],
  },
];
