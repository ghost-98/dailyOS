export type JobApplicationStatus =
  | "planned"
  | "applied"
  | "document_pending"
  | "written_pending"
  | "interview_pending"
  | "result_pending"
  | "accepted"
  | "rejected"
  | "closed";

export type JobProcessStepType =
  | "application"
  | "document"
  | "written"
  | "coding_test"
  | "assignment"
  | "interview"
  | "medical"
  | "result"
  | "employment"
  | "etc";

export type JobProcessStepStatus = "draft" | "confirmed" | "done" | "skipped";

export type JobRequirementCategory = "eligibility" | "preferred" | "document" | "exam" | "interview" | "note";

export type AiExtractionStatus = "draft" | "reviewed" | "applied" | "discarded";

export type JobApplication = {
  id: string;
  companyName: string;
  postingTitle: string;
  jobRole: string;
  status: JobApplicationStatus;
  postingUrl?: string;
  sourceFilePath?: string;
  sourceFileName?: string;
  memo?: string;
};

export type JobApplicationBundle = JobApplication & {
  steps: JobApplicationStep[];
  requirements: JobApplicationRequirement[];
  checkItems: JobApplicationCheckItem[];
};

export const jobApplicationStatusLabels: Record<JobApplicationStatus, string> = {
  planned: "지원 예정",
  applied: "지원 완료",
  document_pending: "서류 대기",
  written_pending: "필기 대기",
  interview_pending: "면접 대기",
  result_pending: "결과 대기",
  accepted: "합격",
  rejected: "불합격",
  closed: "마감",
};

export type JobApplicationStep = {
  id: string;
  applicationId: string;
  type: JobProcessStepType;
  title: string;
  startAt?: string;
  endAt?: string;
  status: JobProcessStepStatus;
  orderIndex: number;
  memo?: string;
  sourceText?: string;
  confirmedByUser: boolean;
};

export type JobApplicationRequirement = {
  id: string;
  applicationId: string;
  category: JobRequirementCategory;
  title: string;
  content: string;
  sourceText?: string;
  confirmedByUser: boolean;
};

export type JobApplicationCheckItem = {
  id: string;
  applicationId: string;
  title: string;
  category: JobRequirementCategory;
  dueAt?: string;
  isDone: boolean;
  memo?: string;
};

export type JobPostingExtractionStep = {
  type: JobProcessStepType;
  title: string;
  startAt?: string;
  endAt?: string;
  memo?: string;
  sourceText?: string;
  confidence: number;
};

export type JobPostingExtractionRequirement = {
  category: JobRequirementCategory;
  title: string;
  content: string;
  sourceText?: string;
  confidence: number;
};

export type JobPostingExtractionCheckItem = {
  title: string;
  category: JobRequirementCategory;
  dueAt?: string;
  memo?: string;
  sourceText?: string;
  confidence: number;
};

export type JobPostingExtraction = {
  companyName?: string;
  postingTitle?: string;
  jobRole?: string;
  postingUrl?: string;
  summary?: string;
  steps: JobPostingExtractionStep[];
  requirements: JobPostingExtractionRequirement[];
  checkItems: JobPostingExtractionCheckItem[];
  warnings: string[];
  modelName?: string;
};

export const jobProcessStepLabels: Record<JobProcessStepType, string> = {
  application: "접수",
  document: "서류",
  written: "필기",
  coding_test: "코딩테스트",
  assignment: "과제",
  interview: "면접",
  medical: "검진",
  result: "결과",
  employment: "입사",
  etc: "기타",
};

export const defaultJobProcessStepTypes: JobProcessStepType[] = [
  "application",
  "document",
  "written",
  "coding_test",
  "assignment",
  "interview",
  "medical",
  "result",
  "employment",
];
