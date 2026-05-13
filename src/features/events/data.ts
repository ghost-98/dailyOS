export type PersonalEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  category: "deadline" | "exam" | "meeting" | "personal" | "career" | "etc";
  source: "직접 등록" | "취업" | "자격증" | "건강";
  memo?: string;
};

export const eventCategoryLabels: Record<PersonalEvent["category"], string> = {
  deadline: "마감",
  exam: "시험",
  meeting: "약속",
  personal: "개인",
  career: "취업",
  etc: "기타",
};

export const personalEvents: PersonalEvent[] = [
  {
    id: "event-1",
    title: "공기업 채용 설명회",
    date: "2026-05-13",
    time: "19:00",
    category: "career",
    source: "직접 등록",
    memo: "온라인 세미나, 질문 목록 준비",
  },
  {
    id: "event-2",
    title: "정보처리기사 원서접수 시작",
    date: "2026-05-18",
    category: "exam",
    source: "자격증",
    memo: "Q-Net 공지 확인",
  },
  {
    id: "event-3",
    title: "한국전력공사 서류 마감",
    date: "2026-05-26",
    time: "23:59",
    category: "deadline",
    source: "취업",
    memo: "지원서, 경험기술서, 자격증 파일 최종 확인",
  },
];
