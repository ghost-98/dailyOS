import type { CareerEvent, HealthSummary, ScheduleSummary, TodoSummary } from "@/types/domain";

export const schedules: ScheduleSummary[] = [
  {
    id: "schedule-1",
    title: "팀 주간 회의",
    startsAt: "09:00",
    endsAt: "10:00",
    place: "컨퍼런스 룸 B",
    category: "업무",
  },
  {
    id: "schedule-2",
    title: "제품 디자인 리뷰",
    startsAt: "13:30",
    endsAt: "14:30",
    place: "온라인 Google Meet",
    category: "리뷰",
  },
  {
    id: "schedule-3",
    title: "개인 학습 시간",
    startsAt: "16:00",
    place: "취소됨",
    category: "학습",
    status: "canceled",
  },
];

export const todos: TodoSummary[] = [
  {
    id: "todo-1",
    title: "주간 보고서 초안 작성",
    status: "done",
    priority: "high",
    dueLabel: "오늘 18:00",
  },
  {
    id: "todo-2",
    title: "비타민 챙겨먹기",
    status: "done",
    priority: "normal",
    dueLabel: "아침",
  },
  {
    id: "todo-3",
    title: "알고리즘 문제 3개 풀기",
    status: "inProgress",
    priority: "high",
    dueLabel: "오늘",
  },
  {
    id: "todo-4",
    title: "영어 단어 50개 복습",
    status: "todo",
    priority: "low",
    dueLabel: "오늘",
  },
];

export const health: HealthSummary = {
  vitalsIndex: 78,
  weightKg: 72.4,
  muscleMassKg: 34.8,
  bodyFatPercent: 18.5,
  workoutPlan: "상체 근력 트레이닝",
  workoutDetail: "가슴 / 어깨 강화",
};

export const careerEvents: CareerEvent[] = [
  {
    id: "career-1",
    company: "네이버 테크 인턴십",
    role: "Frontend Intern",
    kind: "deadline",
    dateLabel: "서류 마감: 5/26 23:59",
    dday: "D-2",
    status: "urgent",
  },
  {
    id: "career-2",
    company: "토스 코딩테스트",
    role: "Software Engineer",
    kind: "exam",
    dateLabel: "일시: 5/28 19:00",
    dday: "D-4",
    status: "urgent",
  },
  {
    id: "career-3",
    company: "카카오 2차 면접",
    role: "Frontend",
    kind: "interview",
    dateLabel: "일시: 5/31 14:00",
    dday: "D-7",
    status: "muted",
  },
];
