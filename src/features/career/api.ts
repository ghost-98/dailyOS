import { supabase } from "@/lib/supabase";
import type { ApplicationEvent, ApplicationEventStage, CareerRecord, CareerTab } from "./data";
import type {
  JobApplicationBundle,
  JobApplicationCheckItem,
  JobApplicationRequirement,
  JobApplicationStatus,
  JobApplicationStep,
  JobPostingExtraction,
} from "./job-model";

type CareerRecordRow = {
  id: string;
  tab: CareerTab;
  title: string;
  subtitle: string;
  status: string;
  primary_date: string | null;
  deadline_date: string | null;
  exam_date: string | null;
  interview_date: string | null;
  result_date: string | null;
  url: string | null;
  resume_name: string | null;
  required_certs: string | null;
  required_docs: string | null;
  certificate_number: string | null;
  issuer: string | null;
  expires_never: boolean | null;
  certificate_file_path: string | null;
  certificate_file_name: string | null;
  priority: "high" | "normal" | "low" | null;
  memo: string | null;
  application_events?: ApplicationEventRow[];
};

type ApplicationEventRow = {
  id: string;
  stage: ApplicationEventStage;
  event_date: string;
  memo: string | null;
};

type CareerRecordInsert = Omit<CareerRecordRow, "id" | "application_events"> & {
  user_id: string;
};

type CareerRecordUpdate = Partial<Omit<CareerRecordInsert, "user_id">>;

type JobApplicationRow = {
  id: string;
  company_name: string;
  posting_title: string;
  job_role: string;
  status: JobApplicationStatus;
  posting_url: string | null;
  source_file_path: string | null;
  source_file_name: string | null;
  memo: string | null;
  job_application_steps?: JobApplicationStepRow[];
  job_application_requirements?: JobApplicationRequirementRow[];
  job_application_check_items?: JobApplicationCheckItemRow[];
};

type JobApplicationStepRow = {
  id: string;
  application_id: string;
  type: JobApplicationStep["type"];
  title: string;
  start_at: string | null;
  end_at: string | null;
  status: JobApplicationStep["status"];
  order_index: number;
  memo: string | null;
  source_text: string | null;
  confirmed_by_user: boolean;
};

type JobApplicationRequirementRow = {
  id: string;
  application_id: string;
  category: JobApplicationRequirement["category"];
  title: string;
  content: string;
  source_text: string | null;
  confirmed_by_user: boolean;
};

type JobApplicationCheckItemRow = {
  id: string;
  application_id: string;
  title: string;
  category: JobApplicationCheckItem["category"];
  due_at: string | null;
  is_done: boolean;
  memo: string | null;
};

const recordColumns = `
  id,tab,title,subtitle,status,primary_date,deadline_date,exam_date,interview_date,result_date,url,resume_name,
  required_certs,required_docs,certificate_number,issuer,expires_never,certificate_file_path,certificate_file_name,priority,memo,
  application_events(id,stage,event_date,memo)
`;

const jobApplicationColumns = `
  id,company_name,posting_title,job_role,status,posting_url,source_file_path,source_file_name,memo
`;

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function emptyToNull(value?: string) {
  return value?.trim() ? value.trim() : null;
}

function timestampToNull(value?: string) {
  const normalized = normalizeTimestamp(value);
  return normalized || null;
}

function normalizeTimestamp(value?: string) {
  const raw = value?.trim();
  if (!raw) return "";

  const compact = raw.replace(/\s+/, "T");
  const hasDateTime = /\d{4}-\d{2}-\d{2}[T\s]\d{1,2}:\d{2}/.test(raw);
  const normalizedWithZone = compact.replace(/(T\d{1,2}:\d{2}(?::\d{2})?)([+-]\d{2}:?\d{2}|Z)$/i, (_match, time, zone) => {
    const safeTime = time.length === 6 ? `${time}:00` : time;
    const safeZone = zone === "Z" || zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
    return `${safeTime}${safeZone}`;
  });

  if (hasDateTime && !Number.isNaN(new Date(normalizedWithZone).getTime())) return normalizedWithZone;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00+09:00`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const dateOnly = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return dateOnly ? `${dateOnly}T00:00:00+09:00` : raw;
}

export type JobApplicationTemplatePayload = {
  companyName: string;
  postingTitle: string;
  jobRole: string;
  postingUrl?: string;
  memo?: string;
  steps?: Array<{
    type: JobApplicationStep["type"];
    title: string;
    startAt?: string;
    endAt?: string;
    memo?: string;
    sourceText?: string;
  }>;
  requirements?: Array<{
    category: JobApplicationRequirement["category"];
    title: string;
    content: string;
    sourceText?: string;
  }>;
  checkItems?: Array<{
    category: JobApplicationCheckItem["category"];
    title: string;
    dueAt?: string;
    memo?: string;
  }>;
};

async function insertJobApplicationTemplateData({
  applicationId,
  checkItems = [],
  requirements = [],
  steps = [],
  userId,
}: {
  applicationId: string;
  checkItems?: NonNullable<JobApplicationTemplatePayload["checkItems"]>;
  requirements?: NonNullable<JobApplicationTemplatePayload["requirements"]>;
  steps?: NonNullable<JobApplicationTemplatePayload["steps"]>;
  userId: string;
}) {
  if (!supabase) return;

  const stepRows = steps
    .filter((step) => step.title?.trim())
    .map((step, index) => ({
      user_id: userId,
      application_id: applicationId,
      type: step.type,
      title: step.title.trim(),
      start_at: timestampToNull(step.startAt),
      end_at: timestampToNull(step.endAt),
      status: "confirmed",
      order_index: index,
      memo: emptyToNull(step.memo),
      source_text: emptyToNull(step.sourceText),
      confirmed_by_user: true,
    }));

  if (stepRows.length > 0) {
    const { error } = await supabase.from("job_application_steps").insert(stepRows);
    if (error) throw toDbError(error, "전형 일정 저장에 실패했습니다.");
  }

  const requirementRows = requirements
    .filter((requirement) => requirement.title?.trim())
    .map((requirement) => ({
      user_id: userId,
      application_id: applicationId,
      category: requirement.category,
      title: requirement.title.trim(),
      content: requirement.content.trim(),
      source_text: emptyToNull(requirement.sourceText),
      confirmed_by_user: true,
    }));

  if (requirementRows.length > 0) {
    const { error } = await supabase.from("job_application_requirements").insert(requirementRows);
    if (error) throw toDbError(error, "지원자격/우대사항 저장에 실패했습니다.");
  }

  const checkItemRows = checkItems
    .filter((item) => item.title?.trim())
    .map((item) => ({
      user_id: userId,
      application_id: applicationId,
      title: item.title.trim(),
      category: item.category,
      due_at: timestampToNull(item.dueAt),
      is_done: false,
      memo: emptyToNull(item.memo),
    }));

  if (checkItemRows.length > 0) {
    const { error } = await supabase.from("job_application_check_items").insert(checkItemRows);
    if (error) throw toDbError(error, "준비 체크 항목 저장에 실패했습니다.");
  }
}

async function rollbackJobApplication(applicationId: string) {
  if (!supabase) return;
  await Promise.allSettled([
    supabase.from("job_application_check_items").delete().eq("application_id", applicationId),
    supabase.from("job_application_requirements").delete().eq("application_id", applicationId),
    supabase.from("job_application_steps").delete().eq("application_id", applicationId),
    supabase.from("job_application_files").delete().eq("application_id", applicationId),
  ]);
  await supabase.from("job_applications").delete().eq("id", applicationId);
}

async function assertJobApplicationTemplateVisible({
  applicationId,
  checkItemCount = 0,
  requirementCount = 0,
  stepCount = 0,
}: {
  applicationId: string;
  checkItemCount?: number;
  requirementCount?: number;
  stepCount?: number;
}) {
  if (!supabase) return;

  const checks = [
    { count: stepCount, label: "전형 일정", table: "job_application_steps" },
    { count: requirementCount, label: "자격/가점 요건", table: "job_application_requirements" },
    { count: checkItemCount, label: "준비 체크 항목", table: "job_application_check_items" },
  ];

  for (const check of checks) {
    if (check.count === 0) continue;
    const { count, error } = await supabase
      .from(check.table)
      .select("id", { count: "exact", head: true })
      .eq("application_id", applicationId);

    if (error) throw toDbError(error, `${check.label} 저장 확인에 실패했습니다.`);
    if ((count ?? 0) === 0) {
      throw new Error(`${check.label}이 저장됐는지 확인할 수 없습니다. Supabase RLS 정책을 다시 적용해주세요.`);
    }
  }
}

async function linkLatestAiDraftToApplication({
  applicationId,
  sourceFilePath,
  userId,
}: {
  applicationId: string;
  sourceFilePath?: string;
  userId: string;
}) {
  if (!supabase || !sourceFilePath) return;
  await supabase
    .from("ai_extraction_drafts")
    .update({ application_id: applicationId, status: "applied" })
    .eq("user_id", userId)
    .eq("source_file_path", sourceFilePath);
}

function toDbError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  const message = getDbErrorMessage(error);
  if (message) return new Error(message);
  return new Error(fallback);
}

function getDbErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.details, maybeError.code].filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length > 0) return parts.join(" ");
  }
  return "";
}

function isJobPostingExtraction(value: unknown): value is JobPostingExtraction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { steps?: unknown; requirements?: unknown; checkItems?: unknown; warnings?: unknown };
  return Array.isArray(candidate.steps) && Array.isArray(candidate.requirements) && Array.isArray(candidate.checkItems) && Array.isArray(candidate.warnings);
}

function mapExtractionStepToRow(step: JobPostingExtraction["steps"][number], userId: string, applicationId: string, index: number) {
  return {
    user_id: userId,
    application_id: applicationId,
    type: step.type,
    title: step.title.trim(),
    start_at: timestampToNull(step.startAt),
    end_at: timestampToNull(step.endAt),
    status: "confirmed",
    order_index: index,
    memo: emptyToNull(step.memo),
    source_text: emptyToNull(step.sourceText),
    confirmed_by_user: false,
  };
}

function mapExtractionRequirementToRow(requirement: JobPostingExtraction["requirements"][number], userId: string, applicationId: string) {
  return {
    user_id: userId,
    application_id: applicationId,
    category: requirement.category,
    title: requirement.title.trim(),
    content: requirement.content.trim(),
    source_text: emptyToNull(requirement.sourceText),
    confirmed_by_user: false,
  };
}

function mapExtractionCheckItemToRow(item: JobPostingExtraction["checkItems"][number], userId: string, applicationId: string) {
  return {
    user_id: userId,
    application_id: applicationId,
    title: item.title.trim(),
    category: item.category,
    due_at: timestampToNull(item.dueAt),
    is_done: false,
    memo: emptyToNull(item.memo || item.sourceText),
  };
}

function toDateOnly(value?: string) {
  return value?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function toTimeOnly(value?: string) {
  if (!value?.includes("T")) return null;
  return value.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
}

function mapApplicationEventRow(row: ApplicationEventRow): ApplicationEvent {
  return {
    id: row.id,
    stage: row.stage,
    date: row.event_date,
    memo: row.memo ?? undefined,
  };
}

function mapCareerRecordRow(row: CareerRecordRow): CareerRecord {
  return {
    id: row.id,
    tab: row.tab,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    primaryDate: row.primary_date ?? undefined,
    deadlineDate: row.deadline_date ?? undefined,
    examDate: row.exam_date ?? undefined,
    interviewDate: row.interview_date ?? undefined,
    resultDate: row.result_date ?? undefined,
    url: row.url ?? undefined,
    resumeName: row.resume_name ?? undefined,
    requiredCerts: row.required_certs ?? undefined,
    requiredDocs: row.required_docs ?? undefined,
    certificateNumber: row.certificate_number ?? undefined,
    issuer: row.issuer ?? undefined,
    expiresNever: row.expires_never ?? undefined,
    certificateFilePath: row.certificate_file_path ?? undefined,
    certificateFileName: row.certificate_file_name ?? undefined,
    priority: row.priority ?? undefined,
    memo: row.memo ?? undefined,
    applicationEvents: row.application_events?.map(mapApplicationEventRow) ?? [],
  };
}

function mapJobApplicationRow(row: JobApplicationRow): JobApplicationBundle {
  return {
    id: row.id,
    companyName: row.company_name,
    postingTitle: row.posting_title,
    jobRole: row.job_role,
    status: row.status,
    postingUrl: row.posting_url ?? undefined,
    sourceFilePath: row.source_file_path ?? undefined,
    sourceFileName: row.source_file_name ?? undefined,
    memo: row.memo ?? undefined,
    steps: (row.job_application_steps ?? [])
      .map((step) => ({
        id: step.id,
        applicationId: step.application_id,
        type: step.type,
        title: step.title,
        startAt: step.start_at ?? undefined,
        endAt: step.end_at ?? undefined,
        status: step.status,
        orderIndex: step.order_index,
        memo: step.memo ?? undefined,
        sourceText: step.source_text ?? undefined,
        confirmedByUser: step.confirmed_by_user,
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex),
    requirements: (row.job_application_requirements ?? []).map((requirement) => ({
      id: requirement.id,
      applicationId: requirement.application_id,
      category: requirement.category,
      title: requirement.title,
      content: requirement.content,
      sourceText: requirement.source_text ?? undefined,
      confirmedByUser: requirement.confirmed_by_user,
    })),
    checkItems: (row.job_application_check_items ?? []).map((item) => ({
      id: item.id,
      applicationId: item.application_id,
      title: item.title,
      category: item.category,
      dueAt: item.due_at ?? undefined,
      isDone: item.is_done,
      memo: item.memo ?? undefined,
    })),
  };
}

function attachJobApplicationChildren(
  applications: JobApplicationBundle[],
  children: {
    checkItems?: JobApplicationCheckItemRow[];
    requirements?: JobApplicationRequirementRow[];
    steps?: JobApplicationStepRow[];
  },
) {
  const stepsByApplication = new Map<string, JobApplicationStepRow[]>();
  const requirementsByApplication = new Map<string, JobApplicationRequirementRow[]>();
  const checkItemsByApplication = new Map<string, JobApplicationCheckItemRow[]>();

  for (const step of children.steps ?? []) {
    stepsByApplication.set(step.application_id, [...(stepsByApplication.get(step.application_id) ?? []), step]);
  }

  for (const requirement of children.requirements ?? []) {
    requirementsByApplication.set(requirement.application_id, [...(requirementsByApplication.get(requirement.application_id) ?? []), requirement]);
  }

  for (const item of children.checkItems ?? []) {
    checkItemsByApplication.set(item.application_id, [...(checkItemsByApplication.get(item.application_id) ?? []), item]);
  }

  return applications.map((application) =>
    mapJobApplicationRow({
      id: application.id,
      company_name: application.companyName,
      posting_title: application.postingTitle,
      job_role: application.jobRole,
      status: application.status,
      posting_url: application.postingUrl ?? null,
      source_file_path: application.sourceFilePath ?? null,
      source_file_name: application.sourceFileName ?? null,
      memo: application.memo ?? null,
      job_application_steps: stepsByApplication.get(application.id) ?? [],
      job_application_requirements: requirementsByApplication.get(application.id) ?? [],
      job_application_check_items: checkItemsByApplication.get(application.id) ?? [],
    }),
  );
}

function mapRecordToInsert(record: CareerRecord, userId: string): CareerRecordInsert {
  return {
    user_id: userId,
    tab: record.tab,
    title: record.title,
    subtitle: record.subtitle,
    status: record.status,
    primary_date: emptyToNull(record.primaryDate),
    deadline_date: emptyToNull(record.deadlineDate),
    exam_date: emptyToNull(record.examDate),
    interview_date: emptyToNull(record.interviewDate),
    result_date: emptyToNull(record.resultDate),
    url: emptyToNull(record.url),
    resume_name: emptyToNull(record.resumeName),
    required_certs: emptyToNull(record.requiredCerts),
    required_docs: emptyToNull(record.requiredDocs),
    certificate_number: emptyToNull(record.certificateNumber),
    issuer: emptyToNull(record.issuer),
    expires_never: record.expiresNever ?? null,
    certificate_file_path: emptyToNull(record.certificateFilePath),
    certificate_file_name: emptyToNull(record.certificateFileName),
    priority: record.priority ?? null,
    memo: emptyToNull(record.memo),
  };
}

function mapRecordToUpdate(record: CareerRecord): CareerRecordUpdate {
  const { user_id: _userId, ...update } = mapRecordToInsert(record, "");
  return update;
}

function mapEventToInsert(event: ApplicationEvent, recordId: string, userId: string) {
  return {
    user_id: userId,
    career_record_id: recordId,
    stage: event.stage,
    event_date: event.date,
    memo: emptyToNull(event.memo),
  };
}

async function replaceApplicationEvents(record: CareerRecord, recordId: string, userId: string) {
  if (!supabase) return;
  await supabase.from("application_events").delete().eq("career_record_id", recordId);

  const events = (record.applicationEvents ?? []).filter((event) => event.date);
  if (record.tab !== "applied" || events.length === 0) return;

  const { error } = await supabase.from("application_events").insert(events.map((event) => mapEventToInsert(event, recordId, userId)));
  if (error) throw toDbError(error, "채용공고 저장에 실패했습니다.");
}

export async function fetchCareerRecordsFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("career_records")
    .select(recordColumns)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as CareerRecordRow[]).map(mapCareerRecordRow);
}

export async function createCareerRecordInDb(record: CareerRecord) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("career_records")
    .insert(mapRecordToInsert(record, userId))
    .select(recordColumns)
    .single();

  if (error) throw error;
  const created = mapCareerRecordRow(data as CareerRecordRow);
  await replaceApplicationEvents(record, created.id, userId);
  return fetchCareerRecordsFromDb().then((records) => records?.find((item) => item.id === created.id) ?? created);
}

export async function updateCareerRecordInDb(record: CareerRecord) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("career_records")
    .update(mapRecordToUpdate(record))
    .eq("id", record.id)
    .select(recordColumns)
    .single();

  if (error) throw error;
  const updated = mapCareerRecordRow(data as CareerRecordRow);
  await replaceApplicationEvents(record, record.id, userId);
  return fetchCareerRecordsFromDb().then((records) => records?.find((item) => item.id === updated.id) ?? updated);
}

export async function deleteCareerRecordFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("career_records").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function fetchJobApplicationsFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("job_applications")
    .select(jobApplicationColumns)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const applications = (data as JobApplicationRow[]).map(mapJobApplicationRow);
  const applicationIds = applications.map((application) => application.id);
  if (applicationIds.length === 0) return applications;

  const [stepsResult, requirementsResult, checkItemsResult] = await Promise.all([
    supabase
      .from("job_application_steps")
      .select("id,application_id,type,title,start_at,end_at,status,order_index,memo,source_text,confirmed_by_user")
      .in("application_id", applicationIds)
      .order("order_index", { ascending: true }),
    supabase
      .from("job_application_requirements")
      .select("id,application_id,category,title,content,source_text,confirmed_by_user")
      .in("application_id", applicationIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("job_application_check_items")
      .select("id,application_id,title,category,due_at,is_done,memo")
      .in("application_id", applicationIds)
      .order("created_at", { ascending: true }),
  ]);

  if (stepsResult.error) throw toDbError(stepsResult.error, "전형 일정 조회에 실패했습니다.");
  if (requirementsResult.error) throw toDbError(requirementsResult.error, "자격/가점 요건 조회에 실패했습니다.");
  if (checkItemsResult.error) throw toDbError(checkItemsResult.error, "준비 체크 항목 조회에 실패했습니다.");

  return attachJobApplicationChildren(applications, {
    steps: stepsResult.data as JobApplicationStepRow[],
    requirements: requirementsResult.data as JobApplicationRequirementRow[],
    checkItems: checkItemsResult.data as JobApplicationCheckItemRow[],
  });
}

export async function createJobApplicationFromExtraction({
  extraction,
  sourceFileName,
  sourceFilePath,
}: {
  extraction: JobPostingExtraction;
  sourceFileName?: string;
  sourceFilePath?: string;
}) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      user_id: userId,
      company_name: extraction.companyName?.trim() || "기업명 미확인",
      posting_title: extraction.postingTitle?.trim() || "채용공고",
      job_role: extraction.jobRole?.trim() || "",
      status: "planned",
      posting_url: emptyToNull(extraction.postingUrl),
      source_file_path: emptyToNull(sourceFilePath),
      source_file_name: emptyToNull(sourceFileName),
      memo: null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const applicationId = (data as { id: string }).id;

  try {
    await insertJobApplicationTemplateData({
      applicationId,
      userId,
      steps: extraction.steps,
      requirements: extraction.requirements,
      checkItems: extraction.checkItems,
    });
    await assertJobApplicationTemplateVisible({
      applicationId,
      stepCount: extraction.steps.filter((step) => step.title?.trim()).length,
      requirementCount: extraction.requirements.filter((requirement) => requirement.title?.trim()).length,
      checkItemCount: extraction.checkItems.filter((item) => item.title?.trim()).length,
    });

    if (sourceFilePath && sourceFileName) {
      const { error: fileError } = await supabase.from("job_application_files").insert({
        user_id: userId,
        application_id: applicationId,
        kind: "posting",
        file_path: sourceFilePath,
        file_name: sourceFileName,
      });
      if (fileError) console.warn("Failed to save linked job posting file metadata", fileError);
      await linkLatestAiDraftToApplication({ applicationId, sourceFilePath, userId });
    }
  } catch (templateError) {
    await rollbackJobApplication(applicationId);
    throw templateError;
  }

  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function createManualJobApplicationInDb({
  checkItems,
  companyName,
  postingTitle,
  jobRole,
  postingUrl,
  requirements,
  steps,
  memo,
}: JobApplicationTemplatePayload) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      user_id: userId,
      company_name: companyName.trim(),
      posting_title: postingTitle.trim(),
      job_role: jobRole.trim(),
      status: "planned",
      posting_url: emptyToNull(postingUrl),
      memo: emptyToNull(memo),
    })
    .select("id")
    .single();

  if (error) throw error;
  const applicationId = (data as { id: string }).id;

  try {
    await insertJobApplicationTemplateData({
      applicationId,
      userId,
      steps,
      requirements,
      checkItems,
    });
    await assertJobApplicationTemplateVisible({
      applicationId,
      stepCount: steps?.filter((step) => step.title?.trim()).length ?? 0,
      requirementCount: requirements?.filter((requirement) => requirement.title?.trim()).length ?? 0,
      checkItemCount: checkItems?.filter((item) => item.title?.trim()).length ?? 0,
    });
  } catch (templateError) {
    await rollbackJobApplication(applicationId);
    throw templateError;
  }

  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function updateJobApplicationInDb(
  applicationId: string,
  payload: { companyName: string; postingTitle: string; jobRole: string; postingUrl?: string; memo?: string },
) {
  if (!supabase) return null;

  const { error } = await supabase
    .from("job_applications")
    .update({
      company_name: payload.companyName.trim(),
      posting_title: payload.postingTitle.trim(),
      job_role: payload.jobRole.trim(),
      posting_url: emptyToNull(payload.postingUrl),
      memo: emptyToNull(payload.memo),
    })
    .eq("id", applicationId);

  if (error) throw toDbError(error, "공고 기본정보 저장에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function deleteJobApplicationFromDb(applicationId: string) {
  if (!supabase) return false;

  const { data: rpcDeleted, error: rpcError } = await supabase.rpc("delete_own_job_application", {
    p_application_id: applicationId,
  });

  if (!rpcError) {
    if (rpcDeleted) return true;
    throw new Error("공고가 삭제되지 않았습니다. 현재 로그인 계정이 이 공고의 소유자인지 확인해주세요.");
  }

  const rpcMessage = getDbErrorMessage(rpcError);
  if (!rpcMessage.includes("delete_own_job_application")) {
    throw toDbError(rpcError, "공고 삭제에 실패했습니다.");
  }

  const { data: application, error: readError } = await supabase
    .from("job_applications")
    .select("id,source_file_path")
    .eq("id", applicationId)
    .maybeSingle();

  if (readError) throw toDbError(readError, "공고 삭제 전 조회에 실패했습니다.");
  if (!application) throw new Error("삭제할 공고를 찾지 못했습니다. Supabase RLS 정책이나 소유자(user_id)를 확인해주세요.");

  const sourceFilePath = (application as { source_file_path?: string | null }).source_file_path;
  const cleanupTargets = [
    { table: "job_application_check_items", label: "준비 체크" },
    { table: "job_application_requirements", label: "지원 요건" },
    { table: "job_application_steps", label: "전형 일정" },
  ];

  for (const target of cleanupTargets) {
    const { error } = await supabase.from(target.table).delete().eq("application_id", applicationId);
    if (error) throw toDbError(error, `${target.label} 정리에 실패했습니다.`);
  }

  const { error: fileLinkError } = await supabase.from("job_application_files").delete().eq("application_id", applicationId);
  if (fileLinkError) throw toDbError(fileLinkError, "공고 파일 연결 정리에 실패했습니다.");

  if (sourceFilePath) {
    const { error: draftError } = await supabase.from("ai_extraction_drafts").delete().eq("source_file_path", sourceFilePath);
    if (draftError) throw toDbError(draftError, "AI 초안 정리에 실패했습니다.");

    const { error: orphanFileError } = await supabase.from("job_application_files").delete().eq("file_path", sourceFilePath);
    if (orphanFileError) throw toDbError(orphanFileError, "공고 파일 메타데이터 정리에 실패했습니다.");
  }

  const { error } = await supabase.from("job_applications").delete().eq("id", applicationId);
  if (error) throw toDbError(error, "공고 삭제에 실패했습니다.");

  const { data: remaining, error: verifyError } = await supabase.from("job_applications").select("id").eq("id", applicationId).maybeSingle();
  if (verifyError) throw toDbError(verifyError, "공고 삭제 확인에 실패했습니다.");
  if (remaining) throw new Error("공고가 삭제되지 않았습니다. Supabase RLS 정책이나 소유자(user_id)를 확인해주세요.");

  return true;
}

export async function markJobApplicationAsApplied(application: JobApplicationBundle) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { error } = await supabase
    .from("job_applications")
    .update({ status: "applied" })
    .eq("id", application.id);

  if (error) throw error;

  const calendarRows = application.steps
    .filter((step) => step.startAt || step.endAt)
    .map((step) => ({
      user_id: userId,
      event_date: toDateOnly(step.startAt ?? step.endAt),
      event_time: toTimeOnly(step.startAt),
      type: "career",
      title: `${application.companyName} · ${step.title}`,
      meta: application.postingTitle,
    }))
    .filter((row) => row.event_date);

  if (calendarRows.length > 0) {
    const { error: calendarError } = await supabase.from("calendar_events").insert(calendarRows);
    if (calendarError) throw calendarError;
  }

  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === application.id) ?? null;
}

export async function createJobApplicationStepInDb(
  applicationId: string,
  step: {
    type: JobApplicationStep["type"];
    title: string;
    startAt?: string;
    endAt?: string;
    memo?: string;
    sourceText?: string;
  },
) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const applications = await fetchJobApplicationsFromDb();
  const application = applications?.find((item) => item.id === applicationId);
  const orderIndex = application?.steps.length ?? 0;

  const { error } = await supabase.from("job_application_steps").insert({
    user_id: userId,
    application_id: applicationId,
    type: step.type,
    title: step.title.trim(),
    start_at: timestampToNull(step.startAt),
    end_at: timestampToNull(step.endAt),
    status: "confirmed",
    order_index: orderIndex,
    memo: emptyToNull(step.memo),
    source_text: emptyToNull(step.sourceText),
    confirmed_by_user: true,
  });

  if (error) throw toDbError(error, "전형 일정 추가에 실패했습니다.");
  const nextApplications = await fetchJobApplicationsFromDb();
  return nextApplications?.find((item) => item.id === applicationId) ?? null;
}

export async function updateJobApplicationStepInDb(
  applicationId: string,
  stepId: string,
  step: {
    type: JobApplicationStep["type"];
    title: string;
    startAt?: string;
    endAt?: string;
    memo?: string;
    sourceText?: string;
  },
) {
  if (!supabase) return null;
  const { error } = await supabase
    .from("job_application_steps")
    .update({
      type: step.type,
      title: step.title.trim(),
      start_at: timestampToNull(step.startAt),
      end_at: timestampToNull(step.endAt),
      memo: emptyToNull(step.memo),
      source_text: emptyToNull(step.sourceText),
      confirmed_by_user: true,
    })
    .eq("id", stepId);

  if (error) throw toDbError(error, "전형 일정 수정에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === applicationId) ?? null;
}

export async function deleteJobApplicationStepFromDb(applicationId: string, stepId: string) {
  if (!supabase) return null;
  const { error } = await supabase.from("job_application_steps").delete().eq("id", stepId);
  if (error) throw toDbError(error, "전형 일정 삭제에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === applicationId) ?? null;
}

export async function updateJobApplicationStepStatus(applicationId: string, stepId: string, status: JobApplicationStep["status"]) {
  if (!supabase) return null;
  const { error } = await supabase
    .from("job_application_steps")
    .update({ status })
    .eq("id", stepId);

  if (error) throw error;
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === applicationId) ?? null;
}

export async function createJobApplicationRequirementInDb(
  applicationId: string,
  requirement: {
    category: JobApplicationRequirement["category"];
    title: string;
    content: string;
    sourceText?: string;
  },
) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { error } = await supabase.from("job_application_requirements").insert({
    user_id: userId,
    application_id: applicationId,
    category: requirement.category,
    title: requirement.title.trim(),
    content: requirement.content.trim(),
    source_text: emptyToNull(requirement.sourceText),
    confirmed_by_user: true,
  });

  if (error) throw toDbError(error, "지원 요건 추가에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === applicationId) ?? null;
}

export async function updateJobApplicationRequirementInDb(
  applicationId: string,
  requirementId: string,
  requirement: {
    category: JobApplicationRequirement["category"];
    title: string;
    content: string;
    sourceText?: string;
  },
) {
  if (!supabase) return null;
  const { error } = await supabase
    .from("job_application_requirements")
    .update({
      category: requirement.category,
      title: requirement.title.trim(),
      content: requirement.content.trim(),
      source_text: emptyToNull(requirement.sourceText),
      confirmed_by_user: true,
    })
    .eq("id", requirementId);

  if (error) throw toDbError(error, "지원 요건 수정에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === applicationId) ?? null;
}

export async function deleteJobApplicationRequirementFromDb(applicationId: string, requirementId: string) {
  if (!supabase) return null;
  const { error } = await supabase.from("job_application_requirements").delete().eq("id", requirementId);
  if (error) throw toDbError(error, "지원 요건 삭제에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === applicationId) ?? null;
}

export async function createJobApplicationCheckItemInDb(
  applicationId: string,
  item: { category: JobApplicationCheckItem["category"]; title: string; dueAt?: string; memo?: string },
) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { error } = await supabase.from("job_application_check_items").insert({
    user_id: userId,
    application_id: applicationId,
    category: item.category,
    title: item.title.trim(),
    due_at: timestampToNull(item.dueAt),
    is_done: false,
    memo: emptyToNull(item.memo),
  });

  if (error) throw toDbError(error, "준비 체크 추가에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function updateJobApplicationCheckItemInDb(
  applicationId: string,
  itemId: string,
  item: { category: JobApplicationCheckItem["category"]; title: string; dueAt?: string; memo?: string; isDone?: boolean },
) {
  if (!supabase) return null;
  const { error } = await supabase
    .from("job_application_check_items")
    .update({
      category: item.category,
      title: item.title.trim(),
      due_at: timestampToNull(item.dueAt),
      memo: emptyToNull(item.memo),
      ...(typeof item.isDone === "boolean" ? { is_done: item.isDone } : {}),
    })
    .eq("id", itemId);

  if (error) throw toDbError(error, "준비 체크 수정에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function deleteJobApplicationCheckItemFromDb(applicationId: string, itemId: string) {
  if (!supabase) return null;
  const { error } = await supabase.from("job_application_check_items").delete().eq("id", itemId);
  if (error) throw toDbError(error, "준비 체크 삭제에 실패했습니다.");
  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function uploadCertificateFileToDb(file: File, recordId: string, existingPath?: string) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "file";
  const safeExtension = extension?.replace(/[^a-zA-Z0-9]/g, "") || "file";
  const path = `${userId}/certificates/${recordId}-${Date.now()}.${safeExtension}`;

  if (existingPath) {
    await supabase.storage.from("career-files").remove([existingPath]);
  }

  const { error } = await supabase.storage.from("career-files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  return {
    path,
    name: file.name,
  };
}

export async function getCertificateFileDownloadUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("career-files").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function getJobPostingFileDownloadUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("career-files").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadJobPostingFileToDb(file: File) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const safeExtension = extension?.replace(/[^a-zA-Z0-9]/g, "") || "pdf";
  const path = `${userId}/job-postings/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

  const { error } = await supabase.storage.from("career-files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { error: fileError } = await supabase.from("job_application_files").insert({
    user_id: userId,
    application_id: null,
    kind: "posting",
    file_path: path,
    file_name: file.name,
    mime_type: file.type || "application/pdf",
    size_bytes: file.size,
  });

  if (fileError) {
    console.warn("Failed to save job posting file metadata", fileError);
  }

  return {
    path,
    name: file.name,
  };
}

export async function createAiExtractionDraftInDb({
  extraction,
  modelName,
  sourceFileName,
  sourceFilePath,
}: {
  extraction: JobPostingExtraction;
  modelName?: string;
  sourceFileName?: string;
  sourceFilePath?: string;
}) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("ai_extraction_drafts")
    .insert({
      user_id: userId,
      application_id: null,
      source_file_path: sourceFilePath ?? null,
      source_file_name: sourceFileName ?? null,
      extracted_json: extraction,
      status: "draft",
      model_name: modelName ?? extraction.modelName ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Failed to save AI extraction draft", error);
    return null;
  }

  return data as { id: string };
}

export async function applyLatestAiDraftToJobApplication(application: JobApplicationBundle) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId || !application.sourceFilePath) return null;

  const { data, error } = await supabase
    .from("ai_extraction_drafts")
    .select("id,extracted_json")
    .eq("source_file_path", application.sourceFilePath)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw toDbError(error, "AI 초안 조회에 실패했습니다.");
  const extraction = (data as { extracted_json?: unknown } | null)?.extracted_json;
  if (!isJobPostingExtraction(extraction)) throw new Error("반영할 AI 초안이 없습니다. PDF를 다시 분석해 주세요.");

  const { error: deleteStepsError } = await supabase.from("job_application_steps").delete().eq("application_id", application.id);
  if (deleteStepsError) throw toDbError(deleteStepsError, "기존 전형 일정 정리에 실패했습니다.");

  const { error: deleteRequirementsError } = await supabase.from("job_application_requirements").delete().eq("application_id", application.id);
  if (deleteRequirementsError) throw toDbError(deleteRequirementsError, "기존 지원 요건 정리에 실패했습니다.");

  const { error: deleteCheckItemsError } = await supabase.from("job_application_check_items").delete().eq("application_id", application.id);
  if (deleteCheckItemsError) throw toDbError(deleteCheckItemsError, "기존 준비 체크 정리에 실패했습니다.");

  const stepRows = extraction.steps
    .filter((step) => step.title?.trim())
    .map((step, index) => mapExtractionStepToRow(step, userId, application.id, index));

  if (stepRows.length > 0) {
    const { error: stepsError } = await supabase.from("job_application_steps").insert(stepRows);
    if (stepsError) throw toDbError(stepsError, "AI 전형 일정 반영에 실패했습니다.");
  }

  const requirementRows = extraction.requirements
    .filter((requirement) => requirement.title?.trim())
    .map((requirement) => mapExtractionRequirementToRow(requirement, userId, application.id));

  if (requirementRows.length > 0) {
    const { error: requirementsError } = await supabase.from("job_application_requirements").insert(requirementRows);
    if (requirementsError) throw toDbError(requirementsError, "AI 지원 요건 반영에 실패했습니다.");
  }

  const checkItemRows = extraction.checkItems
    .filter((item) => item.title?.trim())
    .map((item) => mapExtractionCheckItemToRow(item, userId, application.id));

  if (checkItemRows.length > 0) {
    const { error: checkItemsError } = await supabase.from("job_application_check_items").insert(checkItemRows);
    if (checkItemsError) throw toDbError(checkItemsError, "AI 준비 체크 반영에 실패했습니다.");
  }

  const { error: appError } = await supabase
    .from("job_applications")
    .update({
      company_name: extraction.companyName?.trim() || application.companyName,
      posting_title: extraction.postingTitle?.trim() || application.postingTitle,
      job_role: extraction.jobRole?.trim() || application.jobRole,
      posting_url: emptyToNull(extraction.postingUrl) ?? emptyToNull(application.postingUrl),
    })
    .eq("id", application.id);
  if (appError) throw toDbError(appError, "AI 기본정보 반영에 실패했습니다.");

  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((item) => item.id === application.id) ?? null;
}
