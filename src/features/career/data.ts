export type CareerTab = "applied" | "planned" | "certificates" | "resumes";

export type CareerRecord = {
  id: string;
  tab: CareerTab;
  title: string;
  subtitle: string;
  status: string;
  primaryDate?: string;
  deadlineDate?: string;
  examDate?: string;
  interviewDate?: string;
  resultDate?: string;
  url?: string;
  resumeName?: string;
  requiredCerts?: string;
  requiredDocs?: string;
  certificateNumber?: string;
  issuer?: string;
  score?: string;
  grade?: string;
  priority?: "high" | "normal" | "low";
  memo?: string;
};

export const careerRecords: CareerRecord[] = [
  {
    id: "career-applied-1",
    tab: "applied",
    title: "한국전력공사",
    subtitle: "ICT 운영 / 전산직",
    status: "필기 준비",
    primaryDate: "2026-05-10",
    deadlineDate: "2026-05-26",
    examDate: "2026-06-08",
    interviewDate: "2026-06-24",
    resultDate: "2026-07-05",
    url: "https://recruit.kepco.co.kr",
    resumeName: "공기업 ICT 기본 이력서 v2",
    memo: "NCS 전공 비중 확인, 경험기술서 보완 필요",
  },
  {
    id: "career-applied-2",
    tab: "applied",
    title: "국민건강보험공단",
    subtitle: "정보보안 / 전산",
    status: "서류 작성 중",
    primaryDate: "2026-05-12",
    deadlineDate: "2026-05-31",
    url: "https://www.nhis.or.kr",
    resumeName: "공기업 ICT 기본 이력서 v2",
  },
  {
    id: "career-planned-1",
    tab: "planned",
    title: "한국도로공사",
    subtitle: "전산직",
    status: "관심",
    primaryDate: "2026 하반기",
    url: "https://www.ex.co.kr",
    requiredCerts: "정보처리기사, SQLD",
    requiredDocs: "경험기술서, 자격증 사본",
    priority: "high",
    memo: "상반기 공고 직무기술서 기준으로 키워드 정리",
  },
  {
    id: "career-cert-1",
    tab: "certificates",
    title: "정보처리기사",
    subtitle: "한국산업인력공단",
    status: "보유",
    primaryDate: "2025-06-20",
    deadlineDate: "2030-06-20",
    certificateNumber: "25202000000A",
    issuer: "한국산업인력공단",
    grade: "기사",
    url: "https://www.q-net.or.kr",
  },
  {
    id: "career-resume-1",
    tab: "resumes",
    title: "공기업 ICT 기본 이력서 v2",
    subtitle: "전산직 공통",
    status: "사용 중",
    primaryDate: "2026-05-13",
    url: "https://drive.example.com/resume-public-ict",
    memo: "프로젝트 경험 2번 문항을 기관별로 교체",
  },
];
