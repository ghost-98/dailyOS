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
  id,company_name,posting_title,job_role,status,posting_url,source_file_path,source_file_name,memo,
  job_application_steps(id,application_id,type,title,start_at,end_at,status,order_index,memo,source_text,confirmed_by_user),
  job_application_requirements(id,application_id,category,title,content,source_text,confirmed_by_user),
  job_application_check_items(id,application_id,title,category,due_at,is_done,memo)
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

function toDbError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.details, maybeError.code].filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length > 0) return new Error(parts.join(" "));
  }
  return new Error(fallback);
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
    start_at: emptyToNull(step.startAt),
    end_at: emptyToNull(step.endAt),
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
  return (data as JobApplicationRow[]).map(mapJobApplicationRow);
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

  const stepRows = extraction.steps
    .filter((step) => step.title?.trim())
    .map((step, index) => mapExtractionStepToRow(step, userId, applicationId, index));

  if (stepRows.length > 0) {
    const { error: stepsError } = await supabase.from("job_application_steps").insert(stepRows);
    if (stepsError) throw toDbError(stepsError, "전형 일정 저장에 실패했습니다.");
  }

  const requirementRows = extraction.requirements
    .filter((requirement) => requirement.title?.trim())
    .map((requirement) => mapExtractionRequirementToRow(requirement, userId, applicationId));

  if (requirementRows.length > 0) {
    const { error: requirementsError } = await supabase.from("job_application_requirements").insert(requirementRows);
    if (requirementsError) throw toDbError(requirementsError, "지원자격/우대사항 저장에 실패했습니다.");
  }

  if (sourceFilePath && sourceFileName) {
    const { error: fileError } = await supabase.from("job_application_files").insert({
      user_id: userId,
      application_id: applicationId,
      kind: "posting",
      file_path: sourceFilePath,
      file_name: sourceFileName,
    });
    if (fileError) console.warn("Failed to save linked job posting file metadata", fileError);
  }

  const applications = await fetchJobApplicationsFromDb();
  return applications?.find((application) => application.id === applicationId) ?? null;
}

export async function createManualJobApplicationInDb({
  companyName,
  postingTitle,
  jobRole,
  postingUrl,
  memo,
}: {
  companyName: string;
  postingTitle: string;
  jobRole: string;
  postingUrl?: string;
  memo?: string;
}) {
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
  const { error } = await supabase.from("job_applications").delete().eq("id", applicationId);
  if (error) throw toDbError(error, "공고 삭제에 실패했습니다.");
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
    start_at: emptyToNull(step.startAt),
    end_at: emptyToNull(step.endAt),
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
      start_at: emptyToNull(step.startAt),
      end_at: emptyToNull(step.endAt),
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
