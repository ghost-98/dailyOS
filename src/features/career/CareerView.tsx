"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  ClipboardList,
  Download,
  FileBadge,
  FileText,
  LinkIcon,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  createCareerRecordInDb,
  deleteCareerRecordFromDb,
  fetchCareerRecordsFromDb,
  getCertificateFileDownloadUrl,
  updateCareerRecordInDb,
  uploadCertificateFileToDb,
} from "./api";
import {
  applicationEventStageLabels,
  careerRecords,
  type ApplicationEvent,
  type ApplicationEventStage,
  type CareerRecord,
  type CareerTab,
} from "./data";
import { defaultJobProcessStepTypes, jobProcessStepLabels, type JobProcessStepType } from "./job-model";

const tabLabels: Record<CareerTab, string> = {
  applied: "지원한 기업",
  planned: "지원 예정",
  certificates: "자격증",
};

const tabDescriptions: Record<CareerTab, string> = {
  applied: "지원한 기업의 상태, 마감일, 결과 발표일, 서류/필기/면접 이벤트를 관리합니다.",
  planned: "앞으로 지원할 기업과 준비 상태, 필요 자격증, 필요 서류를 정리합니다.",
  certificates: "보유 자격증의 시행기관, 번호, 취득일, 유효기간, 증빙 파일을 관리합니다.",
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

const statusOptions: Record<CareerTab, string[]> = {
  applied: ["지원 준비", "지원 완료", "서류 대기", "서류 합격", "필기 예정", "면접 예정", "결과 대기", "합격", "불합격", "보류"],
  planned: ["관심", "준비 중", "공고 대기", "서류 준비", "우선 지원", "보류"],
  certificates: ["취득", "응시 예정", "만료"],
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
  const [certificateQuery, setCertificateQuery] = useState("");
  const [certificateStatusFilter, setCertificateStatusFilter] = useState("");

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
  const displayedRecords = useMemo(() => {
    if (activeTab !== "certificates") return visibleRecords;

    const query = certificateQuery.trim().toLowerCase();
    return visibleRecords
      .filter((record) => {
        const matchesStatus = !certificateStatusFilter || record.status === certificateStatusFilter;
        const matchesQuery =
          query.length === 0 ||
          [record.title, record.subtitle, record.issuer, record.certificateNumber, record.status]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);

        return matchesStatus && matchesQuery;
      })
      .sort(compareCertificatesByAcquiredDate);
  }, [activeTab, certificateQuery, certificateStatusFilter, visibleRecords]);

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

        {activeTab === "certificates" ? (
          <div className="certificate-browser">
            <aside className="certificate-index-panel" aria-label="자격증 탐색">
              <label className="certificate-search">
                <span>검색</span>
                <input
                  placeholder="자격증명, 시행기관, 번호"
                  value={certificateQuery}
                  onChange={(event) => setCertificateQuery(event.target.value)}
                />
              </label>

              <div className="certificate-status-filter" aria-label="자격증 상태 필터">
                {statusOptions.certificates.map((status) => (
                  <button
                    className={certificateStatusFilter === status ? "certificate-status-filter__chip certificate-status-filter__chip--active" : "certificate-status-filter__chip"}
                    key={status}
                    onClick={() => setCertificateStatusFilter((current) => (current === status ? "" : status))}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="certificate-index-list">
                <span>목차</span>
                {displayedRecords.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => document.getElementById(`career-record-${record.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    type="button"
                  >
                    <strong>{record.title}</strong>
                    <small>{record.issuer ?? record.subtitle}</small>
                  </button>
                ))}
                {visibleRecords.length > 0 && displayedRecords.length === 0 ? <p>검색 결과가 없습니다.</p> : null}
              </div>
            </aside>

            <CareerRecordList
              activeTab={activeTab}
              emptyDescription={visibleRecords.length > 0 && displayedRecords.length === 0 ? "검색어나 상태 필터를 조정해 보세요." : undefined}
              emptyTitle={visibleRecords.length > 0 && displayedRecords.length === 0 ? "검색 결과가 없습니다." : undefined}
              isLoading={isLoading}
              records={displayedRecords}
              onDelete={deleteRecord}
              onEdit={(record) => {
                setEditingRecord(record);
                setIsSheetOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            <CompanyManagementPreview activeTab={activeTab} />
            <CareerRecordList
              activeTab={activeTab}
              isLoading={isLoading}
              records={displayedRecords}
              onDelete={deleteRecord}
              onEdit={(record) => {
                setEditingRecord(record);
                setIsSheetOpen(true);
              }}
            />
          </>
        )}
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

function CompanyManagementPreview({ activeTab }: { activeTab: CareerTab }) {
  const isApplied = activeTab === "applied";

  return (
    <div className="company-management-preview">
      <div className="company-ai-panel">
        <div className="company-ai-panel__icon">
          <FileText aria-hidden size={20} />
        </div>
        <div>
          <span>{isApplied ? "공고 PDF / 첨부자료" : "관심 기업 자료"}</span>
          <strong>{isApplied ? "PDF를 넣고 전형 초안을 정리" : "채용 시기와 준비물을 한 화면에서 정리"}</strong>
          <p>
            {isApplied
              ? "공고 파일을 업로드하면 회사명, 직무, 마감일, 서류/필기/면접 일정을 AI 초안으로 뽑고 사용자가 확정하는 흐름으로 확장할 수 있어요."
              : "아직 공고가 없어도 예상 채용 시기, 필요한 자격증, 준비 서류, 우선순위를 먼저 쌓아둘 수 있어요."}
          </p>
        </div>
        <button className="company-ai-panel__button" type="button" disabled>
          <Sparkles aria-hidden size={15} />
          AI 초안 준비중
        </button>
      </div>

      <div className="company-workflow-grid" aria-label="기업 관리 구성 미리보기">
        <div className="company-workflow-card">
          <span>기본 정보</span>
          <strong>기업 / 공고 / 직무</strong>
          <p>지원일, 마감일, 공고 URL, 이력서 파일까지 같은 카드에서 관리</p>
        </div>
        <div className="company-workflow-card">
          <span>전형 흐름</span>
          <div className="company-stage-strip">
            {defaultJobProcessStepTypes.slice(0, 6).map((stage, index) => (
              <b key={stage} className={index === 2 ? "company-stage-strip__item company-stage-strip__item--active" : "company-stage-strip__item"}>
                {jobProcessStepLabels[stage]}
              </b>
            ))}
          </div>
          <p>회사마다 다른 절차는 단계 카드와 메모로 유연하게 추가</p>
        </div>
        <div className="company-workflow-card">
          <span>준비 체크</span>
          <strong>자격증 / 서류 / 메모</strong>
          <p>가산점, 필기 과목, 제출 파일, 면접 준비 내용을 한곳에 보관</p>
        </div>
      </div>
    </div>
  );
}

function CareerRecordList({
  activeTab,
  emptyDescription,
  emptyTitle,
  isLoading,
  onDelete,
  onEdit,
  records,
}: {
  activeTab: CareerTab;
  emptyDescription?: string;
  emptyTitle?: string;
  isLoading: boolean;
  onDelete: (id: string) => void;
  onEdit: (record: CareerRecord) => void;
  records: CareerRecord[];
}) {
  return (
    <div className="career-record-list">
      {records.map((record) => (
        <CareerRecordCard key={record.id} record={record} onDelete={() => onDelete(record.id)} onEdit={() => onEdit(record)} />
      ))}
      {records.length === 0 ? (
        <div className="career-empty">
          <ClipboardList aria-hidden size={28} />
          <strong>{emptyTitle ?? `${tabLabels[activeTab]} 항목이 없습니다.`}</strong>
          <p>{emptyDescription ?? (isLoading ? "불러오는 중입니다." : "항목을 추가하면 이곳에 표시됩니다.")}</p>
        </div>
      ) : null}
    </div>
  );
}

function CareerRecordCard({ onDelete, onEdit, record }: { onDelete: () => void; onEdit: () => void; record: CareerRecord }) {
  if (record.tab === "certificates") {
    const expiry = getCertificateExpiry(record);

    return (
      <article className="career-record-card certificate-record-card" id={`career-record-${record.id}`}>
        <div className="certificate-record-card__main">
          <div className="certificate-record-card__top">
            <Badge tone={getBadgeTone(record)}>{record.status}</Badge>
          </div>
          <div className="certificate-record-card__title">
            <h3>{record.title}</h3>
            <CopyButton label="자격증명 복사" value={record.title} />
          </div>

          <div className="certificate-detail-grid">
            <MetaBlock canCopy label="시행기관" value={record.issuer ?? record.subtitle} />
            <MetaBlock canCopy label="자격증 번호" value={record.certificateNumber} />
            <MetaBlock label="취득일" value={record.primaryDate} />
            <MetaBlock label="유효기간" value={expiry} />
          </div>

          <div className="certificate-record-card__footer">
            {record.certificateFilePath ? (
              <button className="career-link certificate-download-link" onClick={() => void downloadCertificateFile(record.certificateFilePath)} type="button">
                <Download aria-hidden size={14} />
                {record.certificateFileName ?? "증빙 파일 다운로드"}
              </button>
            ) : (
              <span className="certificate-file-empty">증빙 파일 없음</span>
            )}
            {record.memo ? <small>{record.memo}</small> : null}
          </div>
        </div>
        <div className="record-actions">
          <button aria-label="수정" title="수정" onClick={onEdit} type="button">
            <Pencil aria-hidden size={15} />
          </button>
          <button aria-label="삭제" title="삭제" onClick={onDelete} type="button">
            <Trash2 aria-hidden size={15} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="career-record-card" id={`career-record-${record.id}`}>
      <div className="career-record-main">
        <Badge tone={getBadgeTone(record)}>{record.status}</Badge>
        <h3>{record.title}</h3>
        <p>{record.subtitle}</p>
        <CareerNextStep record={record} />
        {record.tab === "applied" ? <CompanyProcessRail record={record} /> : <PlannedCompanyPrep record={record} />}
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
        <button aria-label="수정" title="수정" onClick={onEdit} type="button">
          <Pencil aria-hidden size={15} />
        </button>
        <button aria-label="삭제" title="삭제" onClick={onDelete} type="button">
          <Trash2 aria-hidden size={15} />
        </button>
      </div>
    </article>
  );
}

function CompanyProcessRail({ record }: { record: CareerRecord }) {
  const stages = getCompanyProcessStages(record);
  const hasAnyDate = stages.some((stage) => stage.date);

  return (
    <div className="company-process-rail" aria-label="전형 진행 흐름">
      {stages.map((stage) => (
        <div className={stage.active ? "company-process-step company-process-step--active" : "company-process-step"} key={stage.key}>
          <span>{stage.label}</span>
          <strong>{stage.date ? formatDisplayDate(stage.date) : hasAnyDate ? "대기" : "미정"}</strong>
          {stage.memo ? <small>{stage.memo}</small> : null}
        </div>
      ))}
    </div>
  );
}

function PlannedCompanyPrep({ record }: { record: CareerRecord }) {
  const items = [
    { label: "채용 시기", value: record.primaryDate },
    { label: "필요 자격증", value: record.requiredCerts },
    { label: "필요 서류", value: record.requiredDocs },
  ].filter((item) => item.value);

  if (items.length === 0) return null;

  return (
    <div className="planned-company-prep">
      {items.map((item) => (
        <span key={item.label}>
          <CheckCircle2 aria-hidden size={14} />
          <b>{item.label}</b>
          {item.value}
        </span>
      ))}
    </div>
  );
}

function MetaBlock({ canCopy = false, label, value }: { canCopy?: boolean; label: string; value?: string }) {
  return (
    <div className="certificate-meta-block">
      <span>
        {label}
        {canCopy && value ? <CopyButton label={`${label} 복사`} value={value} /> : null}
      </span>
      <strong>{value ? formatCertificateValue(label, value) : "-"}</strong>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const copyValue = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <button className="copy-icon-button" aria-label={label} onClick={copyValue} title={label} type="button">
      <Clipboard aria-hidden size={14} />
    </button>
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
  onSave: (record: CareerRecord) => Promise<void> | void;
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
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateField = <Key extends keyof CareerRecord>(key: Key, value: CareerRecord[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveCurrentRecord = async () => {
    if (!form.title.trim()) return;
    setIsSaving(true);

    try {
      const uploadedFile =
        form.tab === "certificates" && certificateFile
          ? await uploadCertificateFileToDb(certificateFile, form.id, form.certificateFilePath)
          : null;

      await onSave({
        ...form,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || getDefaultSubtitle(form.tab),
        status: form.status.trim() || getDefaultStatus(form.tab),
        issuer: form.tab === "certificates" ? form.subtitle.trim() || form.issuer?.trim() || undefined : form.issuer,
        deadlineDate: form.tab === "certificates" && form.expiresNever ? undefined : form.deadlineDate,
        expiresNever: form.tab === "certificates" ? Boolean(form.expiresNever) : undefined,
        certificateFilePath: uploadedFile?.path ?? form.certificateFilePath,
        certificateFileName: uploadedFile?.name ?? form.certificateFileName,
        memo: form.memo?.trim() || undefined,
        applicationEvents: form.tab === "applied" ? form.applicationEvents?.filter((event) => event.date) : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="career-sheet-title"
        aria-modal="true"
        className={`event-sheet career-sheet career-sheet--${form.tab}`}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header career-sheet__header">
          <div>
            <h2 id="career-sheet-title">{record ? `${tabLabels[form.tab]} 수정` : `${tabLabels[form.tab]} 추가`}</h2>
            {form.tab === "certificates" ? null : <p>{tabDescriptions[form.tab]}</p>}
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="event-sheet__body career-sheet__body">
          <div className="event-form-card career-field-card career-form-card">
            <div className="career-form-card__title">
              <strong>{form.tab === "certificates" ? "자격 정보" : "관리 정보"}</strong>
              {form.tab === "certificates" ? null : <span>상태와 관련 날짜를 관리합니다.</span>}
            </div>
            <div className="career-form-card__fields">
              <div className="career-primary-fields">
                <label>
                  <span>{getTitleLabel(form.tab)}</span>
                  <input autoFocus placeholder={getTitlePlaceholder(form.tab)} value={form.title} onChange={(event) => updateField("title", event.target.value)} />
                </label>
                <label>
                  <span>{getSubtitleLabel(form.tab)}</span>
                  <input placeholder={getSubtitlePlaceholder(form.tab)} value={form.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} />
                </label>
              </div>
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
              <CareerSpecificFields form={form} selectedCertificateFile={certificateFile} updateField={updateField} onCertificateFileChange={setCertificateFile} />
              <label className="event-note">
                <span>메모</span>
                <textarea rows={4} placeholder="준비 내용, 참고사항, 다음 액션을 적어두세요." value={form.memo ?? ""} onChange={(event) => updateField("memo", event.target.value)} />
              </label>
            </div>
          </div>
        </div>

        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" disabled={isSaving} onClick={() => void saveCurrentRecord()} type="button">
            {isSaving ? "저장 중" : "저장하기"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CareerSpecificFields({
  form,
  onCertificateFileChange,
  selectedCertificateFile,
  updateField,
}: {
  form: CareerRecord;
  onCertificateFileChange: (file: File | null) => void;
  selectedCertificateFile: File | null;
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
    return (
      <>
        <div className="certificate-form-grid">
          <Field label="자격증 번호" value={form.certificateNumber} onChange={(value) => updateField("certificateNumber", value)} />
          <Field label="취득일" type="date" value={form.primaryDate} onChange={(value) => updateField("primaryDate", value)} />
          <label className="event-form-row certificate-lifetime-row">
            <span>유효기간</span>
            <button
              className={`certificate-lifetime-toggle ${form.expiresNever ? "certificate-lifetime-toggle--active" : ""}`}
              onClick={() => {
                const nextValue = !form.expiresNever;
                updateField("expiresNever", nextValue);
                if (nextValue) updateField("deadlineDate", undefined);
              }}
              type="button"
            >
              평생 유효
            </button>
          </label>
          {form.expiresNever ? null : <Field label="만료일" type="date" value={form.deadlineDate} onChange={(value) => updateField("deadlineDate", value)} />}
        </div>
        <label className="certificate-file-picker">
          <span>증빙 파일</span>
          <input
            accept=".pdf,image/*"
            type="file"
            onChange={(event) => {
              onCertificateFileChange(event.target.files?.[0] ?? null);
            }}
          />
          <strong>{selectedCertificateFile?.name ?? form.certificateFileName ?? "선택된 파일 없음"}</strong>
          <small>PDF 또는 이미지 파일을 업로드할 수 있습니다. 저장하면 Supabase Storage에 보관됩니다.</small>
        </label>
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
  if (record.tab === "certificates") return record.status === "만료" ? "muted" : record.status === "응시 예정" ? "amber" : "green";
  if (record.status.includes("마감") || record.status.includes("준비")) return "amber";
  return "muted";
}

function getDefaultSubtitle(tab: CareerTab) {
  if (tab === "applied" || tab === "planned") return "직무 미정";
  return "시행기관 미정";
}

function getDefaultStatus(tab: CareerTab) {
  if (tab === "applied") return "지원 완료";
  if (tab === "planned") return "준비 중";
  return "취득";
}

function getStatusOptions(tab: CareerTab, currentStatus?: string) {
  const options = statusOptions[tab];
  if (!currentStatus || options.includes(currentStatus)) return options;
  return [currentStatus, ...options];
}

function compareCertificatesByAcquiredDate(a: CareerRecord, b: CareerRecord) {
  const dateDiff = getSortableDateValue(b.primaryDate) - getSortableDateValue(a.primaryDate);
  if (dateDiff !== 0) return dateDiff;
  return a.title.localeCompare(b.title, "ko");
}

function getSortableDateValue(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 0;
  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getCertificateExpiry(record: CareerRecord) {
  if (record.expiresNever) return "평생";
  return record.deadlineDate;
}

function getTitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "자격증명";
  return "기업명";
}

function getTitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "TOEIC 875점, OPIc IH, 정보처리기사 필기 합격";
  return "한국전력공사";
}

function getSubtitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "시행기관";
  return "직무 / 공고명";
}

function getSubtitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "한국산업인력공단";
  return "ICT / 신입 채용";
}

async function downloadCertificateFile(path?: string) {
  if (!path) return;
  const url = await getCertificateFileDownloadUrl(path);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatDisplayDate(value?: string) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCertificateValue(label: string, value: string) {
  if ((label.includes("취득일") || label.includes("유효기간")) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatFullDate(value);
  }

  return value;
}

function formatFullDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, "0")}월 ${String(date.getDate()).padStart(2, "0")}일`;
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

function getCompanyProcessStages(record: CareerRecord) {
  const eventByStage = new Map<ApplicationEventStage, ApplicationEvent>();

  for (const event of record.applicationEvents ?? []) {
    if (!eventByStage.has(event.stage)) eventByStage.set(event.stage, event);
  }

  const stages = [
    {
      key: "application",
      label: jobProcessStepLabels.application,
      date: record.deadlineDate,
      memo: undefined,
    },
    {
      key: "document",
      label: jobProcessStepLabels.document,
      date: eventByStage.get("document")?.date ?? record.deadlineDate,
      memo: eventByStage.get("document")?.memo,
    },
    {
      key: "written",
      label: jobProcessStepLabels.written,
      date: eventByStage.get("written")?.date ?? record.examDate,
      memo: eventByStage.get("written")?.memo,
    },
    {
      key: "interview",
      label: jobProcessStepLabels.interview,
      date: eventByStage.get("interview")?.date ?? record.interviewDate,
      memo: eventByStage.get("interview")?.memo,
    },
    {
      key: "result",
      label: jobProcessStepLabels.result,
      date: record.resultDate,
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
