export type JobApplicationStatus =
  | "watching"
  | "preparing"
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
