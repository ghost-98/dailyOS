import { supabase } from "@/lib/supabase";
import type { ApplicationEvent, ApplicationEventStage, CareerRecord, CareerTab } from "./data";

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

const recordColumns = `
  id,tab,title,subtitle,status,primary_date,deadline_date,exam_date,interview_date,result_date,url,resume_name,
  required_certs,required_docs,certificate_number,issuer,expires_never,certificate_file_path,certificate_file_name,priority,memo,
  application_events(id,stage,event_date,memo)
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
  if (error) throw error;
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
