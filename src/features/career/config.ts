import type { CareerTab } from "@/features/career/data";
import type { JobApplicationRequirement } from "@/features/career/job-model";

export const tabLabels: Record<CareerTab, string> = {
  applied: "지원한 기업",
  certificates: "자격증",
  planned: "지원 예정",
};

export const tabDescriptions: Record<CareerTab, string> = {
  applied: "지원 이후의 전형 단계, 일정, 준비 항목을 관리합니다.",
  certificates: "취득한 자격증, 등록번호, 발급기관, 증빙 파일을 관리합니다.",
  planned: "관심 있는 공고를 보관하고 지원 여부를 결정합니다.",
};

export const priorityLabels = {
  high: "높음",
  low: "낮음",
  normal: "보통",
};

export const requirementCategoryLabels: Record<JobApplicationRequirement["category"], string> = {
  attachment_required: "필요 붙임",
  certificate_bonus: "자격증/가점",
  document: "서류",
  document_evaluation: "서류평가",
  eligibility: "지원자격",
  exam: "필기",
  interview: "면접",
  language_score: "어학",
  note: "메모",
  preferred: "우대사항",
};

export const requirementCategoryOptions: Array<{ label: string; value: JobApplicationRequirement["category"] }> = [
  { label: "지원자격", value: "eligibility" },
  { label: "서류평가", value: "document_evaluation" },
  { label: "어학", value: "language_score" },
  { label: "자격증/가점", value: "certificate_bonus" },
  { label: "우대사항", value: "preferred" },
  { label: "필요 붙임", value: "attachment_required" },
  { label: "서류", value: "document" },
  { label: "필기", value: "exam" },
  { label: "면접", value: "interview" },
  { label: "메모", value: "note" },
];

export const statusOptions: Record<CareerTab, string[]> = {
  applied: ["지원중", "서류 대기", "필기 대기", "면접 대기", "결과 대기", "합격", "불합격", "마감"],
  certificates: ["취득", "응시예정", "만료"],
  planned: ["지원 예정", "관심", "보류", "마감"],
};

export const tabRoutes: Record<CareerTab, string> = {
  applied: "/career/applied",
  certificates: "/career/certificates",
  planned: "/career/planned",
};
