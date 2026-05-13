export type CareerTab = "applied" | "planned" | "certificates";

export type ApplicationEventStage = "document" | "written" | "interview";

export type ApplicationEvent = {
  id: string;
  stage: ApplicationEventStage;
  date: string;
  memo?: string;
};

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
  applicationEvents?: ApplicationEvent[];
  memo?: string;
};

export const applicationEventStageLabels: Record<ApplicationEventStage, string> = {
  document: "서류",
  written: "필기",
  interview: "면접",
};

export const careerRecords: CareerRecord[] = [];
