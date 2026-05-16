"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileBadge,
  LinkIcon,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { createCareerRecordInDb, deleteCareerRecordFromDb, fetchCareerRecordsFromDb, updateCareerRecordInDb } from "./api";
import {
  applicationEventStageLabels,
  careerRecords,
  type ApplicationEvent,
  type ApplicationEventStage,
  type CareerRecord,
  type CareerTab,
  type CertificateResultType,
} from "./data";

const tabLabels: Record<CareerTab, string> = {
  applied: "지원한 기업",
  planned: "지원 예정",
  certificates: "자격증",
};

const tabDescriptions: Record<CareerTab, string> = {
  applied: "지원한 기업의 상태, 마감일, 결과 발표일, 서류/필기/면접 이벤트를 관리합니다.",
  planned: "앞으로 지원할 기업과 준비 상태, 필요 자격증, 필요 서류를 정리합니다.",
  certificates: "보유 자격증의 번호, 발급 기관, 취득일, 만료일, PDF 또는 URL을 관리합니다.",
};

const tabIcons = {
  applied: BriefcaseBusiness,
  planned: Target,
  certificates: FileBadge,
};

const priorityLabels = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

const certificateResultTypeLabels: Record<CertificateResultType, string> = {
  score: "점수",
  passFail: "합불",
  grade: "등급",
};

const statusOptions: Record<CareerTab, string[]> = {
  applied: ["지원 준비", "지원 완료", "서류 대기", "서류 합격", "필기 예정", "면접 예정", "결과 대기", "합격", "불합격", "보류"],
  planned: ["관심", "준비 중", "공고 대기", "서류 준비", "우선 지원", "보류"],
  certificates: ["보유", "준비 중", "접수 예정", "응시 예정", "취득", "갱신 필요", "만료"],
};

const tabRoutes: Record<CareerTab, string> = {
  applied: "/career/applied",
  planned: "/career/planned",
  certificates: "/career/certificates",
};

export function CareerView({ activeTab }: { activeTab: CareerTab }) {
  const router = useRouter();
  const [records, setRecords] = useState<CareerRecord[]>(careerRecords);
  const [editingRecord, setEditingRecord] = useState<CareerRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetchCareerRecordsFromDb()
      .then((dbRecords) => {
        if (isMounted) setRecords(dbRecords ?? []);
      })
      .catch((error) => console.error("Failed to load career records from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleRecords = useMemo(() => records.filter((record) => record.tab === activeTab), [activeTab, records]);

  const saveRecord = async (record: CareerRecord) => {
    const exists = records.some((item) => item.id === record.id);
    const savedRecord = exists ? await updateCareerRecordInDb(record) : await createCareerRecordInDb(record);
    const nextRecord = savedRecord ?? record;

    setRecords((current) => (exists ? current.map((item) => (item.id === record.id ? nextRecord : item)) : [nextRecord, ...current]));
    router.push(tabRoutes[nextRecord.tab]);
    setEditingRecord(null);
    setIsSheetOpen(false);
  };

  const deleteRecord = async (id: string) => {
    await deleteCareerRecordFromDb(id);
    setRecords((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="career-page">
      <header className="page-header career-header">
        <div>
          <h1>{tabLabels[activeTab]}</h1>
          <div className="today__date">
            {renderTabIcon(activeTab)}
            <span>{tabDescriptions[activeTab]}</span>
          </div>
        </div>
        <button
          className="header-action"
          onClick={() => {
            setEditingRecord(null);
            setIsSheetOpen(true);
          }}
          type="button"
        >
          <Plus aria-hidden size={18} />
          항목 추가
        </button>
      </header>

      <SectionCard className="career-management-card">
        <div className="section-heading">
          <div className="card-title">
            {renderTabIcon(activeTab)}
            <span>{tabLabels[activeTab]}</span>
          </div>
          <p className="section-description">{tabDescriptions[activeTab]}</p>
        </div>

        <div className="career-record-list">
          {visibleRecords.map((record) => (
            <CareerRecordCard
              key={record.id}
              record={record}
              onDelete={() => deleteRecord(record.id)}
              onEdit={() => {
                setEditingRecord(record);
                setIsSheetOpen(true);
              }}
            />
          ))}
          {visibleRecords.length === 0 ? (
            <div className="career-empty">
              <ClipboardList aria-hidden size={28} />
              <strong>{tabLabels[activeTab]} 항목이 없습니다.</strong>
              <p>{isLoading ? "불러오는 중입니다." : "항목을 추가하면 이곳에 표시됩니다."}</p>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {isSheetOpen ? (
        <CareerRecordSheet
          activeTab={activeTab}
          record={editingRecord}
          onClose={() => {
            setEditingRecord(null);
            setIsSheetOpen(false);
          }}
          onSave={saveRecord}
        />
      ) : null}
    </div>
  );
}

function CareerRecordCard({ onDelete, onEdit, record }: { onDelete: () => void; onEdit: () => void; record: CareerRecord }) {
  return (
    <article className="career-record-card">
      <div className="career-record-main">
        <Badge tone={getBadgeTone(record)}>{record.status}</Badge>
        <h3>{record.title}</h3>
        <p>{record.subtitle}</p>
        <CareerNextStep record={record} />
        <CareerMeta record={record} />
        {record.applicationEvents?.length ? <ApplicationEventList events={record.applicationEvents} /> : null}
        {record.url ? (
          <a className="career-link" href={record.url} rel="noreferrer" target="_blank">
            <LinkIcon aria-hidden size={14} />
            링크 열기
          </a>
        ) : null}
        {record.memo ? <small>{record.memo}</small> : null}
      </div>
      <div className="record-actions">
        <button onClick={onEdit} type="button">
          <Pencil aria-hidden size={15} />
          수정
        </button>
        <button onClick={onDelete} type="button">
          <Trash2 aria-hidden size={15} />
          삭제
        </button>
      </div>
    </article>
  );
}

function CareerNextStep({ record }: { record: CareerRecord }) {
  const nextStep = getNextCareerStep(record);
  if (!nextStep) return null;

  return (
    <div className="career-next-step">
      <CalendarClock aria-hidden size={15} />
      <span>{nextStep.label}</span>
      <strong>{formatDisplayDate(nextStep.date)}</strong>
    </div>
  );
}

function CareerMeta({ record }: { record: CareerRecord }) {
  if (record.tab === "applied") {
    return (
      <div className="career-meta-grid">
        <MetaItem icon={<CalendarClock aria-hidden size={14} />} label="지원일" value={record.primaryDate} />
        <MetaItem label="마감일" value={record.deadlineDate} />
        <MetaItem label="시험일" value={record.examDate} />
        <MetaItem label="면접일" value={record.interviewDate} />
        <MetaItem label="결과 발표" value={record.resultDate} />
        <MetaItem label="이력서" value={record.resumeName} />
      </div>
    );
  }

  if (record.tab === "planned") {
    return (
      <div className="career-meta-grid">
        <MetaItem label="예상 시기" value={record.primaryDate} />
        <MetaItem label="우선순위" value={record.priority ? priorityLabels[record.priority] : undefined} />
        <MetaItem label="필요 자격증" value={record.requiredCerts} />
        <MetaItem label="필요 서류" value={record.requiredDocs} />
      </div>
    );
  }

  if (record.tab === "certificates") {
    const result = getCertificateResult(record);

    return (
      <div className="career-meta-grid">
        <MetaItem label="자격증 번호" value={record.certificateNumber} />
        <MetaItem label="발급 기관" value={record.issuer ?? record.subtitle} />
        <MetaItem label="취득일" value={record.primaryDate} />
        <MetaItem label="만료일" value={record.deadlineDate} />
        <MetaItem label={result?.label ?? "결과"} value={result?.value} />
      </div>
    );
  }

  return null;
}

function ApplicationEventList({ events }: { events: ApplicationEvent[] }) {
  return (
    <div className="application-event-list">
      {events.map((event) => (
        <span className="application-event-chip" key={event.id}>
          <b>{applicationEventStageLabels[event.stage]}</b>
          {formatDisplayDate(event.date)}
          {event.memo ? <em>{event.memo}</em> : null}
        </span>
      ))}
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="career-meta-item">
      {icon}
      <b>{label}</b>
      {formatDisplayDate(value)}
    </span>
  );
}

function CareerRecordSheet({
  activeTab,
  onClose,
  onSave,
  record,
}: {
  activeTab: CareerTab;
  onClose: () => void;
  onSave: (record: CareerRecord) => void;
  record: CareerRecord | null;
}) {
  const [form, setForm] = useState<CareerRecord>(
    record ?? {
      id: `career-${Date.now()}`,
      tab: activeTab,
      title: "",
      subtitle: "",
      status: "",
      priority: "normal",
      applicationEvents: [],
    },
  );

  const updateField = <Key extends keyof CareerRecord>(key: Key, value: CareerRecord[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveCurrentRecord = () => {
    if (!form.title.trim()) return;
    const certificateResultType = form.resultType ?? "score";
    const resultValue = form.resultValue?.trim() || undefined;

    onSave({
      ...form,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || getDefaultSubtitle(form.tab),
      status: form.status.trim() || getDefaultStatus(form.tab),
      resultType: form.tab === "certificates" ? certificateResultType : undefined,
      resultValue: form.tab === "certificates" ? resultValue : undefined,
      score: form.tab === "certificates" && certificateResultType === "score" ? resultValue : undefined,
      grade: form.tab === "certificates" && certificateResultType === "grade" ? resultValue : undefined,
      memo: form.memo?.trim() || undefined,
      applicationEvents: form.tab === "applied" ? form.applicationEvents?.filter((event) => event.date) : undefined,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="career-sheet-title" aria-modal="true" className="event-sheet career-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose} type="button">취소</button>
          <h2 id="career-sheet-title">{record ? "항목 수정" : "항목 추가"}</h2>
          <button className="event-sheet__done-button" onClick={saveCurrentRecord} type="button">저장</button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
              <span>분류</span>
              <select value={form.tab} onChange={(event) => updateField("tab", event.target.value as CareerTab)}>
                <option value="applied">지원한 기업</option>
                <option value="planned">지원 예정</option>
                <option value="certificates">자격증</option>
              </select>
            </label>
          </div>

          <div className="event-form-card event-form-card--title">
            <label>
              <span>{getTitleLabel(form.tab)}</span>
              <input autoFocus placeholder={getTitlePlaceholder(form.tab)} value={form.title} onChange={(event) => updateField("title", event.target.value)} />
            </label>
            <label>
              <span>{getSubtitleLabel(form.tab)}</span>
              <input placeholder={getSubtitlePlaceholder(form.tab)} value={form.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} />
            </label>
          </div>

          <div className="event-form-card career-field-card">
            <label className="event-form-row event-form-row--select">
              <span>상태</span>
              <select value={form.status || getDefaultStatus(form.tab)} onChange={(event) => updateField("status", event.target.value)}>
                {getStatusOptions(form.tab, form.status).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <CareerSpecificFields form={form} updateField={updateField} />
            <label className="event-note">
              <span>메모</span>
              <textarea rows={4} placeholder="준비 내용, 참고사항, 다음 액션을 적어두세요." value={form.memo ?? ""} onChange={(event) => updateField("memo", event.target.value)} />
            </label>
          </div>
        </div>

        <button className="event-sheet__floating-close" aria-label="닫기" onClick={onClose} type="button">
          <X aria-hidden size={18} />
        </button>
      </section>
    </div>
  );
}

function CareerSpecificFields({
  form,
  updateField,
}: {
  form: CareerRecord;
  updateField: <Key extends keyof CareerRecord>(key: Key, value: CareerRecord[Key]) => void;
}) {
  if (form.tab === "applied") {
    return (
      <>
        <Field label="지원일" type="date" value={form.primaryDate} onChange={(value) => updateField("primaryDate", value)} />
        <Field label="마감일" type="date" value={form.deadlineDate} onChange={(value) => updateField("deadlineDate", value)} />
        <Field label="시험일" type="date" value={form.examDate} onChange={(value) => updateField("examDate", value)} />
        <Field label="면접일" type="date" value={form.interviewDate} onChange={(value) => updateField("interviewDate", value)} />
        <Field label="결과 발표일" type="date" value={form.resultDate} onChange={(value) => updateField("resultDate", value)} />
        <Field label="공고 URL" value={form.url} onChange={(value) => updateField("url", value)} />
        <Field label="이력서/파일명" value={form.resumeName} onChange={(value) => updateField("resumeName", value)} />
        <ApplicationEventEditor events={form.applicationEvents ?? []} onChange={(events) => updateField("applicationEvents", events)} />
      </>
    );
  }

  if (form.tab === "planned") {
    return (
      <>
        <Field label="예상 채용 시기" value={form.primaryDate} placeholder="2026년 상반기" onChange={(value) => updateField("primaryDate", value)} />
        <label className="event-form-row event-form-row--select">
          <span>우선순위</span>
          <select value={form.priority ?? "normal"} onChange={(event) => updateField("priority", event.target.value as CareerRecord["priority"])}>
            <option value="high">높음</option>
            <option value="normal">보통</option>
            <option value="low">낮음</option>
          </select>
        </label>
        <Field label="공고 URL" value={form.url} onChange={(value) => updateField("url", value)} />
        <Field label="필요 자격증" value={form.requiredCerts} onChange={(value) => updateField("requiredCerts", value)} />
        <Field label="필요 서류" value={form.requiredDocs} onChange={(value) => updateField("requiredDocs", value)} />
      </>
    );
  }

  if (form.tab === "certificates") {
    const resultType = form.resultType ?? "score";

    return (
      <>
        <Field label="자격증 번호" value={form.certificateNumber} onChange={(value) => updateField("certificateNumber", value)} />
        <Field label="발급 기관" value={form.issuer} onChange={(value) => updateField("issuer", value)} />
        <Field label="취득일" type="date" value={form.primaryDate} onChange={(value) => updateField("primaryDate", value)} />
        <Field label="만료일" type="date" value={form.deadlineDate} onChange={(value) => updateField("deadlineDate", value)} />
        <label className="event-form-row event-form-row--select">
          <span>결과 유형</span>
          <select value={resultType} onChange={(event) => updateField("resultType", event.target.value as CertificateResultType)}>
            <option value="score">점수</option>
            <option value="passFail">합불</option>
            <option value="grade">등급</option>
          </select>
        </label>
        {resultType === "passFail" ? (
          <label className="event-form-row event-form-row--select">
            <span>결과</span>
            <select value={form.resultValue ?? ""} onChange={(event) => updateField("resultValue", event.target.value)}>
              <option value="">선택 안 함</option>
              <option value="합격">합격</option>
              <option value="불합격">불합격</option>
            </select>
          </label>
        ) : (
          <Field
            label={certificateResultTypeLabels[resultType]}
            placeholder={resultType === "score" ? "875" : "1급, 2급, IH, AL"}
            value={form.resultValue ?? (resultType === "score" ? form.score : form.grade)}
            onChange={(value) => updateField("resultValue", value)}
          />
        )}
        <Field label="PDF 파일/URL" value={form.url} onChange={(value) => updateField("url", value)} />
      </>
    );
  }

  return null;
}

function ApplicationEventEditor({ events, onChange }: { events: ApplicationEvent[]; onChange: (events: ApplicationEvent[]) => void }) {
  const addEvent = () => {
    onChange([...events, { id: `application-event-${Date.now()}`, stage: "document", date: "", memo: "" }]);
  };

  const updateEvent = <Key extends keyof ApplicationEvent>(id: string, key: Key, value: ApplicationEvent[Key]) => {
    onChange(events.map((event) => (event.id === id ? { ...event, [key]: value } : event)));
  };

  return (
    <div className="application-event-editor">
      <div className="application-event-editor__header">
        <span>전형 이벤트</span>
        <button type="button" onClick={addEvent}>
          <Plus aria-hidden size={14} />
          이벤트 추가
        </button>
      </div>
      {events.length === 0 ? <p>서류, 필기, 면접 날짜와 메모를 추가할 수 있습니다.</p> : null}
      {events.map((event) => (
        <div className="application-event-row" key={event.id}>
          <select value={event.stage} onChange={(changeEvent) => updateEvent(event.id, "stage", changeEvent.target.value as ApplicationEventStage)}>
            <option value="document">서류</option>
            <option value="written">필기</option>
            <option value="interview">면접</option>
          </select>
          <input type="date" value={event.date} onChange={(changeEvent) => updateEvent(event.id, "date", changeEvent.target.value)} />
          <input placeholder="메모" value={event.memo ?? ""} onChange={(changeEvent) => updateEvent(event.id, "memo", changeEvent.target.value)} />
          <button type="button" aria-label="이벤트 삭제" onClick={() => onChange(events.filter((item) => item.id !== event.id))}>
            <Trash2 aria-hidden size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value?: string;
}) {
  return (
    <label className="event-form-row event-form-row--field">
      <span>{label}</span>
      <input placeholder={placeholder} type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function renderTabIcon(tab: CareerTab) {
  const Icon = tabIcons[tab];
  return <Icon aria-hidden size={20} />;
}

function getBadgeTone(record: CareerRecord) {
  if (record.tab === "certificates") return "green";
  if (record.status.includes("마감") || record.status.includes("준비")) return "amber";
  return "muted";
}

function getDefaultSubtitle(tab: CareerTab) {
  if (tab === "applied" || tab === "planned") return "직무 미정";
  return "발급 기관 미정";
}

function getDefaultStatus(tab: CareerTab) {
  if (tab === "applied") return "지원 완료";
  if (tab === "planned") return "준비 중";
  return "보유";
}

function getStatusOptions(tab: CareerTab, currentStatus?: string) {
  const options = statusOptions[tab];
  if (!currentStatus || options.includes(currentStatus)) return options;
  return [currentStatus, ...options];
}

function getCertificateResult(record: CareerRecord) {
  const resultType = record.resultType ?? (record.score ? "score" : record.grade ? "grade" : undefined);
  const value = record.resultValue ?? record.score ?? record.grade;

  if (!resultType || !value) return null;
  return {
    label: certificateResultTypeLabels[resultType],
    value: resultType === "score" && !value.includes("점") ? `${value}점` : value,
  };
}

function getTitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "자격증명";
  return "기업명";
}

function getTitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "정보처리기사";
  return "한국전력공사";
}

function getSubtitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "발급 기관";
  return "직무 / 공고명";
}

function getSubtitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "한국산업인력공단";
  return "ICT / 신입 채용";
}

function formatDisplayDate(value?: string) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getNextCareerStep(record: CareerRecord) {
  const candidates: { label: string; date?: string }[] = [];

  if (record.tab === "applied") {
    candidates.push(
      { label: "마감", date: record.deadlineDate },
      { label: "시험", date: record.examDate },
      { label: "면접", date: record.interviewDate },
      { label: "결과", date: record.resultDate },
      ...(record.applicationEvents ?? []).map((event) => ({
        label: applicationEventStageLabels[event.stage],
        date: event.date,
      })),
    );
  }

  if (record.tab === "planned") {
    candidates.push({ label: "예상 채용", date: record.primaryDate });
  }

  if (record.tab === "certificates") {
    candidates.push({ label: "만료", date: record.deadlineDate }, { label: "취득", date: record.primaryDate });
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
