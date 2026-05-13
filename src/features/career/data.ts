export type CareerTab = "applications" | "planned" | "certificates";

export type CareerRecord = {
  id: string;
  tab: CareerTab;
  title: string;
  subtitle: string;
  dateLabel: string;
  status: string;
  memo?: string;
};

export const careerRecords: CareerRecord[] = [
  {
    id: "career-record-1",
    tab: "applications",
    title: "네이버 테크 인턴십",
    subtitle: "Frontend Intern",
    dateLabel: "마감 5/26 23:59",
    status: "서류 준비",
    memo: "포트폴리오 링크 최종 확인",
  },
  {
    id: "career-record-2",
    tab: "applications",
    title: "토스 코딩테스트",
    subtitle: "Software Engineer",
    dateLabel: "시험 5/28 19:00",
    status: "시험 예정",
  },
  {
    id: "career-record-3",
    tab: "planned",
    title: "라인 하반기 공채",
    subtitle: "Frontend",
    dateLabel: "예상 9월",
    status: "관심",
    memo: "React 프로젝트 정리 필요",
  },
  {
    id: "career-record-4",
    tab: "certificates",
    title: "정보처리기사",
    subtitle: "한국산업인력공단",
    dateLabel: "취득 2025/06/20",
    status: "보유",
  },
];
