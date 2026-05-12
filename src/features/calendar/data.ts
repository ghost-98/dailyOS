import type { EventType } from "@/types/domain";

export type CalendarEvent = {
  id: string;
  date: string;
  type: EventType;
  title: string;
  time?: string;
  meta: string;
};

export const calendarEvents: CalendarEvent[] = [
  {
    id: "schedule-1",
    date: "2026-05-12",
    type: "schedule",
    title: "팀 주간 회의",
    time: "09:00",
    meta: "컨퍼런스 룸 B",
  },
  {
    id: "schedule-1-2",
    date: "2026-05-12",
    type: "schedule",
    title: "제품 디자인 리뷰",
    time: "13:30",
    meta: "Google Meet",
  },
  {
    id: "todo-1",
    date: "2026-05-12",
    type: "todo",
    title: "주간 보고서 초안 작성",
    meta: "HIGH PRIORITY",
  },
  {
    id: "health-1",
    date: "2026-05-12",
    type: "health",
    title: "상체 근력 트레이닝",
    time: "20:00",
    meta: "가슴 / 어깨 강화",
  },
  {
    id: "weight-1",
    date: "2026-05-13",
    type: "weight",
    title: "몸무게 기록",
    meta: "72.4kg / 골격근량 34.8kg",
  },
  {
    id: "career-1",
    date: "2026-05-14",
    type: "career",
    title: "네이버 테크 인턴십 마감",
    time: "23:59",
    meta: "서류 제출",
  },
  {
    id: "schedule-2",
    date: "2026-05-18",
    type: "schedule",
    title: "제품 디자인 리뷰",
    time: "13:30",
    meta: "Google Meet",
  },
  {
    id: "career-2",
    date: "2026-05-21",
    type: "career",
    title: "토스 코딩테스트",
    time: "19:00",
    meta: "온라인 시험",
  },
  {
    id: "todo-2",
    date: "2026-05-24",
    type: "todo",
    title: "자격증 PDF 정리",
    meta: "NORMAL",
  },
  {
    id: "career-3",
    date: "2026-05-28",
    type: "career",
    title: "카카오 2차 면접",
    time: "14:00",
    meta: "Frontend",
  },
];

export const calendarTypeLabels: Record<EventType, string> = {
  schedule: "일정",
  todo: "할 일",
  health: "운동",
  weight: "몸무게",
  career: "취업",
};
