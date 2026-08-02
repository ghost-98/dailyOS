import { applicationEventStageLabels, type ApplicationEvent, type ApplicationEventStage, type CareerRecord, type CareerTab } from "@/features/career/data";
import { jobProcessStepLabels, type JobApplicationStep, type JobProcessStepType } from "@/features/career/job-model";
import { statusOptions } from "@/features/career/config";

export function getBadgeTone(record: CareerRecord) {
  if (record.tab === "certificates") return record.status === "만료" ? "muted" : record.status === "응시 예정" ? "amber" : "green";
  if (record.status.includes("마감") || record.status.includes("준비")) return "amber";
  return "muted";
}

export function getDefaultSubtitle(tab: CareerTab) {
  if (tab === "applied" || tab === "planned") return "직무 미정";
  return "시행기관 미정";
}

export function getDefaultStatus(tab: CareerTab) {
  if (tab === "applied") return "지원 완료";
  if (tab === "planned") return "준비 중";
  return "취득";
}

export function getStatusOptions(tab: CareerTab, currentStatus?: string) {
  const options = statusOptions[tab];
  if (!currentStatus || options.includes(currentStatus)) return options;
  return [currentStatus, ...options];
}

export function compareCertificatesByAcquiredDate(a: CareerRecord, b: CareerRecord) {
  const dateDiff = getSortableDateValue(b.primaryDate) - getSortableDateValue(a.primaryDate);
  if (dateDiff !== 0) return dateDiff;
  return a.title.localeCompare(b.title, "ko");
}

export function getCertificateExpiry(record: CareerRecord) {
  if (record.expiresNever) return "평생";
  return record.deadlineDate;
}

export function getTitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "자격증명";
  return "기업명";
}

export function getTitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "TOEIC 875점, OPIc IH, 정보처리기사 필기 합격";
  return "한국전력공사";
}

export function getSubtitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "시행기관";
  return "직무 / 공고명";
}

export function getSubtitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "한국산업인력공단";
  return "ICT / 신입 채용";
}

export function formatDisplayDate(value?: string) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatCertificateValue(label: string, value: string) {
  if ((label.includes("취득일") || label.includes("유효기간")) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatFullDate(value);
  }

  return value;
}

export function getNextCareerStep(record: CareerRecord) {
  const candidates: { label: string; date?: string }[] = [];

  if (record.tab === "applied") {
    candidates.push(
      { label: "마감", date: record.deadlineDate },
      { label: "시험", date: record.examDate },
      { label: "면접", date: record.interviewDate },
      { label: "결과", date: record.resultDate },
      ...(record.applicationEvents ?? []).map((event) => ({
        date: event.date,
        label: applicationEventStageLabels[event.stage],
      })),
    );
  }

  if (record.tab === "planned") {
    candidates.push({ label: "예상 채용", date: record.primaryDate });
  }

  if (record.tab === "certificates") {
    candidates.push(...(record.expiresNever ? [] : [{ label: "만료", date: record.deadlineDate }]), { label: "취득", date: record.primaryDate });
  }

  const datedCandidates = candidates.filter((candidate): candidate is { label: string; date: string } => Boolean(candidate.date));
  if (datedCandidates.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    datedCandidates
      .map((candidate) => ({
        ...candidate,
        time: new Date(`${candidate.date}T00:00:00`).getTime(),
      }))
      .filter((candidate) => Number.isFinite(candidate.time) && candidate.time >= today.getTime())
      .sort((a, b) => a.time - b.time)[0] ?? datedCandidates.sort((a, b) => b.date.localeCompare(a.date))[0]
  );
}

export function toDatetimeLocalValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIsoFromDatetimeLocal(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

export function formatDraftRange(startAt?: string, endAt?: string) {
  const start = formatDraftDateTime(startAt);
  const end = formatDraftDateTime(endAt);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end;
}

export function formatDraftDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
    month: "numeric",
  }).format(date);
}

export function formatJobStepRange(step: JobApplicationStep) {
  const start = formatDraftDateTime(step.startAt);
  const end = formatDraftDateTime(step.endAt);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end || "날짜 미정";
}

export function getCompanyProcessStages(record: CareerRecord) {
  const eventByStage = new Map<ApplicationEventStage, ApplicationEvent>();

  for (const event of record.applicationEvents ?? []) {
    if (!eventByStage.has(event.stage)) eventByStage.set(event.stage, event);
  }

  const stages = [
    {
      date: record.deadlineDate,
      key: "application",
      label: jobProcessStepLabels.application,
      memo: undefined,
    },
    {
      date: eventByStage.get("document")?.date ?? record.deadlineDate,
      key: "document",
      label: jobProcessStepLabels.document,
      memo: eventByStage.get("document")?.memo,
    },
    {
      date: eventByStage.get("written")?.date ?? record.examDate,
      key: "written",
      label: jobProcessStepLabels.written,
      memo: eventByStage.get("written")?.memo,
    },
    {
      date: eventByStage.get("interview")?.date ?? record.interviewDate,
      key: "interview",
      label: jobProcessStepLabels.interview,
      memo: eventByStage.get("interview")?.memo,
    },
    {
      date: record.resultDate,
      key: "result",
      label: jobProcessStepLabels.result,
      memo: undefined,
    },
  ] satisfies { key: JobProcessStepType; label: string; date?: string; memo?: string }[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDatedStage = stages
    .filter((stage): stage is typeof stage & { date: string } => Boolean(stage.date))
    .map((stage) => ({ ...stage, time: new Date(`${stage.date}T00:00:00`).getTime() }))
    .filter((stage) => Number.isFinite(stage.time) && stage.time >= today.getTime())
    .sort((a, b) => a.time - b.time)[0];

  return stages.map((stage) => ({ ...stage, active: nextDatedStage ? stage.key === nextDatedStage.key : false }));
}

function getSortableDateValue(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 0;
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatFullDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, "0")}월 ${String(date.getDate()).padStart(2, "0")}일`;
}
