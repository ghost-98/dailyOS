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
    id: "schedule-2",
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
    meta: "높은 우선순위",
  },
  {
    id: "event-1",
    date: "2026-05-13",
    type: "event",
    title: "공기업 채용 설명회",
    time: "19:00",
    meta: "온라인 세미나",
  },
  {
    id: "health-1",
    date: "2026-05-12",
    type: "health",
    title: "웨이트 45분",
    time: "20:00",
    meta: "컨디션 보통",
  },
  {
    id: "weight-1",
    date: "2026-05-13",
    type: "weight",
    title: "몸무게 기록",
    meta: "72.4kg / 공복 측정",
  },
  {
    id: "career-1",
    date: "2026-05-14",
    type: "career",
    title: "한국전력공사 서류 마감",
    time: "23:59",
    meta: "ICT 운영 / 전산직",
  },
  {
    id: "event-2",
    date: "2026-05-18",
    type: "event",
    title: "정보처리기사 원서접수 시작",
    meta: "Q-Net 확인",
  },
  {
    id: "career-2",
    date: "2026-05-21",
    type: "career",
    title: "국민건강보험공단 필기",
    time: "19:00",
    meta: "시험장 확인 필요",
  },
  {
    id: "todo-2",
    date: "2026-05-24",
    type: "todo",
    title: "자격증 PDF 정리",
    meta: "보통 우선순위",
  },
  {
    id: "career-3",
    date: "2026-05-28",
    type: "career",
    title: "한국도로공사 면접",
    time: "14:00",
    meta: "전산직",
  },
];

export const calendarTypeLabels: Record<EventType, string> = {
  schedule: "일정",
  todo: "할 일",
  event: "이벤트",
  health: "운동",
  weight: "몸무게",
  career: "취업",
};
