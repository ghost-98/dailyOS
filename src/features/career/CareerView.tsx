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
  applyLatestAiDraftToJobApplication,
  createCareerRecordInDb,
  createAiExtractionDraftInDb,
  createJobApplicationFromExtraction,
  createJobApplicationRequirementInDb,
  createJobApplicationStepInDb,
  createManualJobApplicationInDb,
  deleteCareerRecordFromDb,
  deleteJobApplicationFromDb,
  deleteJobApplicationRequirementFromDb,
  deleteJobApplicationStepFromDb,
  fetchCareerRecordsFromDb,
  fetchJobApplicationsFromDb,
  getCertificateFileDownloadUrl,
  getJobPostingFileDownloadUrl,
  markJobApplicationAsApplied,
  updateCareerRecordInDb,
  updateJobApplicationInDb,
  updateJobApplicationRequirementInDb,
  updateJobApplicationStepInDb,
  updateJobApplicationStepStatus,
  uploadCertificateFileToDb,
  uploadJobPostingFileToDb,
} from "./api";
import {
  applicationEventStageLabels,
  careerRecords,
  type ApplicationEvent,
  type ApplicationEventStage,
  type CareerRecord,
  type CareerTab,
} from "./data";
import {
  defaultJobProcessStepTypes,
  jobApplicationStatusLabels,
  jobProcessStepLabels,
  type JobApplicationBundle,
  type JobApplicationRequirement,
  type JobApplicationStep,
  type JobPostingExtraction,
  type JobProcessStepType,
} from "./job-model";

const tabLabels: Record<CareerTab, string> = {
  applied: "지원한 기업",
  planned: "지원 예정",
  certificates: "자격증",
};

const tabDescriptions: Record<CareerTab, string> = {
  applied: "지원 이후의 전형 단계, 일정, 준비 항목을 관리합니다.",
  planned: "관심 있는 공고를 보관하고 지원 여부를 결정합니다.",
  certificates: "취득한 자격증, 등록번호, 발급기관, 증빙 파일을 관리합니다.",
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
  applied: ["지원중", "서류 대기", "필기 대기", "면접 대기", "결과 대기", "합격", "불합격", "마감"],
  planned: ["지원 예정", "관심", "보류", "마감"],
  certificates: ["취득", "응시예정", "만료"],
};

const tabRoutes: Record<CareerTab, string> = {
  applied: "/career/applied",
  planned: "/career/planned",
  certificates: "/career/certificates",
};

type CareerSheetMode = "certificate" | "manual-job" | "posting-upload";

export function CareerView({ activeTab }: { activeTab: CareerTab }) {
  const router = useRouter();
  const [records, setRecords] = useState<CareerRecord[]>(careerRecords);
  const [editingRecord, setEditingRecord] = useState<CareerRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<CareerSheetMode>(activeTab === "certificates" ? "certificate" : "manual-job");
  const [isLoading, setIsLoading] = useState(true);
  const [jobApplications, setJobApplications] = useState<JobApplicationBundle[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
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

    fetchJobApplicationsFromDb()
      .then((applications) => {
        if (isMounted) setJobApplications(applications ?? []);
      })
      .catch((error) => console.error("Failed to load job applications from Supabase", error));

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
  const plannedApplications = useMemo(() => jobApplications.filter((application) => application.status === "planned"), [jobApplications]);
  const appliedApplications = useMemo(() => jobApplications.filter((application) => application.status !== "planned"), [jobApplications]);
  const activeApplications = activeTab === "planned" ? plannedApplications : appliedApplications;
  const selectedApplication = useMemo(
    () => activeApplications.find((application) => application.id === selectedApplicationId) ?? null,
    [activeApplications, selectedApplicationId],
  );

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

  const saveJobPosting = async (extraction: JobPostingExtraction, file?: { path?: string; name?: string }) => {
    const saved = await createJobApplicationFromExtraction({
      extraction,
      sourceFileName: file?.name,
      sourceFilePath: file?.path,
    });
    if (saved) setJobApplications((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setIsSheetOpen(false);
    router.push("/career/planned");
  };

  const saveManualJobApplication = async (payload: { companyName: string; postingTitle: string; jobRole: string; postingUrl?: string; memo?: string }) => {
    const saved = await createManualJobApplicationInDb(payload);
    if (saved) setJobApplications((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setIsSheetOpen(false);
    router.push("/career/planned");
  };

  const applyJobApplication = async (application: JobApplicationBundle) => {
    const updated = await markJobApplicationAsApplied(application);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedApplicationId(updated?.id ?? application.id);
    router.push("/career/applied");
  };

  const updateStepStatus = async (applicationId: string, stepId: string, status: JobApplicationStep["status"]) => {
    const updated = await updateJobApplicationStepStatus(applicationId, stepId, status);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const updateApplication = async (
    applicationId: string,
    payload: { companyName: string; postingTitle: string; jobRole: string; postingUrl?: string; memo?: string },
  ) => {
    const updated = await updateJobApplicationInDb(applicationId, payload);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deleteApplication = async (applicationId: string) => {
    if (!window.confirm("이 공고를 삭제할까요?")) return;
    try {
      await deleteJobApplicationFromDb(applicationId);
      setJobApplications((current) => current.filter((item) => item.id !== applicationId));
      setSelectedApplicationId((current) => (current === applicationId ? null : current));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "공고 삭제에 실패했습니다.");
    }
  };
  const saveApplicationStep = async (
    applicationId: string,
    step: { type: JobApplicationStep["type"]; title: string; startAt?: string; endAt?: string; memo?: string; sourceText?: string },
    stepId?: string,
  ) => {
    const updated = stepId ? await updateJobApplicationStepInDb(applicationId, stepId, step) : await createJobApplicationStepInDb(applicationId, step);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deleteApplicationStep = async (applicationId: string, stepId: string) => {
    const updated = await deleteJobApplicationStepFromDb(applicationId, stepId);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const saveApplicationRequirement = async (
    applicationId: string,
    requirement: { category: JobApplicationRequirement["category"]; title: string; content: string; sourceText?: string },
    requirementId?: string,
  ) => {
    const updated = requirementId
      ? await updateJobApplicationRequirementInDb(applicationId, requirementId, requirement)
      : await createJobApplicationRequirementInDb(applicationId, requirement);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deleteApplicationRequirement = async (applicationId: string, requirementId: string) => {
    const updated = await deleteJobApplicationRequirementFromDb(applicationId, requirementId);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const applyAiDraftToApplication = async (application: JobApplicationBundle) => {
    const updated = await applyLatestAiDraftToJobApplication(application);
    if (updated) setJobApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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
            setSheetMode(activeTab === "certificates" ? "certificate" : "manual-job");
            setIsSheetOpen(true);
          }}
          type="button"
        >
          <Plus aria-hidden size={18} />
          {activeTab === "certificates" ? "자격증 추가" : "직접 추가"}
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
                setSheetMode("certificate");
                setIsSheetOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            <CompanyManagementPreview
              activeTab={activeTab}
              onManualCreate={() => {
                setEditingRecord(null);
                setSheetMode("manual-job");
                setIsSheetOpen(true);
              }}
              onUploadPosting={() => {
                setEditingRecord(null);
                setSheetMode("posting-upload");
                setIsSheetOpen(true);
              }}
            />
            <JobApplicationBoard
              activeTab={activeTab}
              applications={activeApplications}
              isLoading={isLoading}
              selectedApplicationId={selectedApplicationId}
              onDelete={deleteApplication}
              onApply={applyJobApplication}
              onSelect={setSelectedApplicationId}
              onStepStatusChange={(applicationId, stepId, status) => void updateStepStatus(applicationId, stepId, status)}
            />
            {selectedApplication ? (
              <JobApplicationDetailPanel
                activeTab={activeTab}
                application={selectedApplication}
                onApply={applyJobApplication}
                onClose={() => setSelectedApplicationId(null)}
                onDelete={deleteApplication}
                onDeleteRequirement={deleteApplicationRequirement}
                onDeleteStep={deleteApplicationStep}
                onSaveRequirement={saveApplicationRequirement}
                onSaveStep={saveApplicationStep}
                onApplyAiDraft={applyAiDraftToApplication}
                onStepStatusChange={(applicationId, stepId, status) => void updateStepStatus(applicationId, stepId, status)}
                onUpdateApplication={updateApplication}
              />
            ) : null}
          </>
        )}
      </SectionCard>

      {isSheetOpen && activeTab === "certificates" ? (
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
      {isSheetOpen && activeTab !== "certificates" && sheetMode === "posting-upload" ? (
        <JobPostingUploadSheet onClose={() => setIsSheetOpen(false)} onSaveJobPosting={saveJobPosting} />
      ) : null}
      {isSheetOpen && activeTab !== "certificates" && sheetMode === "manual-job" ? (
        <ManualJobApplicationSheet onClose={() => setIsSheetOpen(false)} onSave={saveManualJobApplication} />
      ) : null}
    </div>
  );
}

function CompanyManagementPreview({
  activeTab,
  onManualCreate,
  onUploadPosting,
}: {
  activeTab: CareerTab;
  onManualCreate: () => void;
  onUploadPosting: () => void;
}) {
  const isPlanned = activeTab === "planned";

  return (
    <div className="job-command-panel">
      <div className="job-command-panel__copy">
        <span>{isPlanned ? "지원 예정 공고" : "지원 진행 관리"}</span>
        <strong>{isPlanned ? "공고를 보관하고 지원할지 결정합니다" : "지원한 공고의 전형 상태를 따라갑니다"}</strong>
        <p>
          PDF 분석은 공고 원문에서 전형 일정과 준비 항목을 뽑아 초안을 만들고, 직접 추가는 회사와 공고명만 먼저 저장할 때 씁니다.
        </p>
      </div>
      <div className="job-command-panel__actions">
        <button className="job-command-card job-command-card--ai" onClick={onUploadPosting} type="button">
          <FileText aria-hidden size={19} />
          <span>PDF로 공고 분석</span>
          <small>전형 일정, 자격요건, 준비 항목 초안 생성</small>
        </button>
        <button className="job-command-card" onClick={onManualCreate} type="button">
          <Plus aria-hidden size={19} />
          <span>직접 추가</span>
          <small>기업명, 공고명, 직무를 빠르게 등록</small>
        </button>
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

function JobApplicationBoard({
  activeTab,
  applications,
  isLoading,
  selectedApplicationId,
  onDelete,
  onApply,
  onSelect,
  onStepStatusChange,
}: {
  activeTab: CareerTab;
  applications: JobApplicationBundle[];
  isLoading: boolean;
  selectedApplicationId: string | null;
  onDelete: (applicationId: string) => Promise<void> | void;
  onApply: (application: JobApplicationBundle) => Promise<void> | void;
  onSelect: (applicationId: string) => void;
  onStepStatusChange: (applicationId: string, stepId: string, status: JobApplicationStep["status"]) => void;
}) {
  if (applications.length === 0) {
    return (
      <div className="career-empty job-empty-state">
        <ClipboardList aria-hidden size={28} />
        <strong>{activeTab === "planned" ? "보관한 지원 예정 공고가 없습니다." : "지원 진행 중인 공고가 없습니다."}</strong>
        <p>
          {isLoading
            ? "취업 데이터를 불러오는 중입니다."
            : activeTab === "planned"
              ? "PDF로 공고를 분석하거나 직접 추가해서 관심 공고를 먼저 모아두세요."
              : "지원 예정 공고에서 지원으로 전환하면 전형 일정이 캘린더에 함께 들어갑니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="job-application-list">
      {applications.map((application) => {
        const visibleJobRole = getVisibleJobRole(application);

        return (
        <article
          className={`job-application-card ${selectedApplicationId === application.id ? "job-application-card--selected" : ""}`}
          key={application.id}
          onClick={() => onSelect(application.id)}
        >
          <div className="job-application-card__header">
            <div>
              <Badge tone={application.status === "planned" ? "amber" : "green"}>{jobApplicationStatusLabels[application.status]}</Badge>
              <h3>{application.companyName}</h3>
              <div className="job-application-meta-row">
                {application.postingTitle ? <span>공고 {application.postingTitle}</span> : null}
                {visibleJobRole ? <span>직무 {visibleJobRole}</span> : null}
              </div>
            </div>
            {activeTab === "planned" ? (
              <button className="job-application-card__primary" onClick={(event) => {
                event.stopPropagation();
                void onApply(application);
              }} type="button">
                지원으로 전환
              </button>
            ) : null}
            <div className="job-application-card__actions">
              <button aria-label="공고 수정" title="공고 수정" onClick={(event) => {
                event.stopPropagation();
                onSelect(application.id);
              }} type="button">
                <Pencil aria-hidden size={14} />
              </button>
              <button aria-label="공고 삭제" title="공고 삭제" onClick={(event) => {
                event.stopPropagation();
                void onDelete(application.id);
              }} type="button">
                <Trash2 aria-hidden size={14} />
              </button>
            </div>
          </div>

          {application.sourceFileName || application.postingUrl ? (
            <div className="job-application-source-row">
              {application.sourceFileName ? <span>{application.sourceFileName}</span> : null}
              {application.sourceFilePath ? (
                <button onClick={(event) => {
                  event.stopPropagation();
                  void openJobPostingFile(application.sourceFilePath);
                }} type="button">
                  <FileText aria-hidden size={14} />
                  PDF 보기
                </button>
              ) : null}
              {application.postingUrl ? (
                <a href={application.postingUrl} rel="noreferrer" target="_blank" onClick={(event) => event.stopPropagation()}>
                  <LinkIcon aria-hidden size={14} />
                  채용사이트
                </a>
              ) : null}
            </div>
          ) : null}

          {application.steps.length > 0 ? (
            <div className="job-step-timeline">
              {application.steps.map((step) => (
                <div className="job-step-card" key={step.id}>
                  <span>{jobProcessStepLabels[step.type]}</span>
                  <strong>{step.title}</strong>
                  <small>{formatJobStepRange(step)}</small>
                  {step.sourceText ? <em>{step.sourceText}</em> : null}
                  {activeTab === "applied" ? (
                    <select
                      value={step.status}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onStepStatusChange(application.id, step.id, event.target.value as JobApplicationStep["status"])}
                    >
                      <option value="confirmed">예정</option>
                      <option value="done">완료</option>
                      <option value="skipped">건너뜀</option>
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {application.requirements.length > 0 ? (
            <div className="job-requirement-strip">
              {application.requirements.slice(0, 5).map((requirement) => (
                <span key={requirement.id}>
                  <b>{requirement.title}</b>
                  {requirement.content}
                </span>
              ))}
            </div>
          ) : null}
        </article>
        );
      })}
    </div>
  );
}

function getVisibleJobRole(application: JobApplicationBundle) {
  const role = application.jobRole.trim();
  if (!role) return "";

  const postingTitle = application.postingTitle.trim();
  if (postingTitle.includes(role)) return "";
  if (/직급|대졸|신입사원|채용공고|채용형|인턴/i.test(role)) return "";

  return role;
}

function JobApplicationDetailPanel({
  activeTab,
  application,
  onApply,
  onClose,
  onDelete,
  onDeleteRequirement,
  onDeleteStep,
  onApplyAiDraft,
  onSaveRequirement,
  onSaveStep,
  onStepStatusChange,
  onUpdateApplication,
}: {
  activeTab: CareerTab;
  application: JobApplicationBundle;
  onApply: (application: JobApplicationBundle) => Promise<void> | void;
  onClose: () => void;
  onDelete: (applicationId: string) => Promise<void> | void;
  onDeleteRequirement: (applicationId: string, requirementId: string) => Promise<void> | void;
  onDeleteStep: (applicationId: string, stepId: string) => Promise<void> | void;
  onApplyAiDraft: (application: JobApplicationBundle) => Promise<void> | void;
  onSaveRequirement: (
    applicationId: string,
    requirement: { category: JobApplicationRequirement["category"]; title: string; content: string; sourceText?: string },
    requirementId?: string,
  ) => Promise<void> | void;
  onSaveStep: (
    applicationId: string,
    step: { type: JobApplicationStep["type"]; title: string; startAt?: string; endAt?: string; memo?: string; sourceText?: string },
    stepId?: string,
  ) => Promise<void> | void;
  onStepStatusChange: (applicationId: string, stepId: string, status: JobApplicationStep["status"]) => void;
  onUpdateApplication: (
    applicationId: string,
    payload: { companyName: string; postingTitle: string; jobRole: string; postingUrl?: string; memo?: string },
  ) => Promise<void> | void;
}) {
  const visibleJobRole = getVisibleJobRole(application);
  const nextStep = application.steps.find((step) => step.status !== "done" && step.status !== "skipped") ?? application.steps[0];
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    companyName: application.companyName,
    postingTitle: application.postingTitle,
    jobRole: application.jobRole,
    postingUrl: application.postingUrl ?? "",
    memo: application.memo ?? "",
  });
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({
    type: "application" as JobApplicationStep["type"],
    title: "",
    startAt: "",
    endAt: "",
    memo: "",
    sourceText: "",
  });
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
  const [requirementForm, setRequirementForm] = useState({
    category: "eligibility" as JobApplicationRequirement["category"],
    title: "",
    content: "",
    sourceText: "",
  });

  const startEditStep = (step: JobApplicationStep) => {
    setEditingStepId(step.id);
    setStepForm({
      type: step.type,
      title: step.title,
      startAt: toDatetimeLocalValue(step.startAt),
      endAt: toDatetimeLocalValue(step.endAt),
      memo: step.memo ?? "",
      sourceText: step.sourceText ?? "",
    });
  };

  const resetStepForm = () => {
    setEditingStepId(null);
    setStepForm({ type: "application", title: "", startAt: "", endAt: "", memo: "", sourceText: "" });
  };

  const startEditRequirement = (requirement: JobApplicationRequirement) => {
    setEditingRequirementId(requirement.id);
    setRequirementForm({
      category: requirement.category,
      title: requirement.title,
      content: requirement.content,
      sourceText: requirement.sourceText ?? "",
    });
  };

  const resetRequirementForm = () => {
    setEditingRequirementId(null);
    setRequirementForm({ category: "eligibility", title: "", content: "", sourceText: "" });
  };

  useEffect(() => {
    setIsEditingInfo(false);
    setInfoForm({
      companyName: application.companyName,
      postingTitle: application.postingTitle,
      jobRole: application.jobRole,
      postingUrl: application.postingUrl ?? "",
      memo: application.memo ?? "",
    });
    resetStepForm();
    resetRequirementForm();
  }, [application.id]);

  return (
    <aside className="job-detail-panel" aria-label="공고 상세">
      <div className="job-detail-panel__top">
        <div>
          <Badge tone={application.status === "planned" ? "amber" : "green"}>{jobApplicationStatusLabels[application.status]}</Badge>
          {isEditingInfo ? (
            <div className="job-detail-info-form">
              <input value={infoForm.companyName} placeholder="기업명" onChange={(event) => setInfoForm((current) => ({ ...current, companyName: event.target.value }))} />
              <input value={infoForm.postingTitle} placeholder="공고명" onChange={(event) => setInfoForm((current) => ({ ...current, postingTitle: event.target.value }))} />
              <input value={infoForm.jobRole} placeholder="지원 직무" onChange={(event) => setInfoForm((current) => ({ ...current, jobRole: event.target.value }))} />
              <input value={infoForm.postingUrl} placeholder="채용사이트 URL" onChange={(event) => setInfoForm((current) => ({ ...current, postingUrl: event.target.value }))} />
              <textarea rows={2} value={infoForm.memo} placeholder="메모" onChange={(event) => setInfoForm((current) => ({ ...current, memo: event.target.value }))} />
              <div className="job-detail-inline-actions">
                <button onClick={() => {
                  void onUpdateApplication(application.id, infoForm);
                  setIsEditingInfo(false);
                }} type="button">저장</button>
                <button onClick={() => setIsEditingInfo(false)} type="button">취소</button>
              </div>
            </div>
          ) : (
            <>
              <h2>{application.companyName}</h2>
              <p>{application.postingTitle || "공고명 미입력"}</p>
            </>
          )}
        </div>
        <div className="job-detail-top-actions">
          <button aria-label="공고 수정" title="공고 수정" className="event-sheet__icon-button" onClick={() => setIsEditingInfo((current) => !current)} type="button">
            <Pencil aria-hidden size={16} />
          </button>
          <button aria-label="공고 삭제" title="공고 삭제" className="event-sheet__icon-button" onClick={() => void onDelete(application.id)} type="button">
            <Trash2 aria-hidden size={16} />
          </button>
          <button aria-label="상세 닫기" className="event-sheet__icon-button" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </div>
      </div>

      <div className="job-detail-meta-grid">
        <DetailMeta label="지원 직무" value={visibleJobRole || application.jobRole || "직무 확인 필요"} />
        <DetailMeta label="다음 일정" value={nextStep ? `${jobProcessStepLabels[nextStep.type]} · ${formatJobStepRange(nextStep) || nextStep.title}` : "등록된 일정 없음"} />
      </div>

      <div className="job-detail-actions">
        {application.sourceFilePath ? (
          <button onClick={() => void openJobPostingFile(application.sourceFilePath)} type="button">
            <FileText aria-hidden size={15} />
            PDF 보기
          </button>
        ) : null}
        {application.postingUrl ? (
          <a href={application.postingUrl} rel="noreferrer" target="_blank">
            <LinkIcon aria-hidden size={15} />
            채용사이트
          </a>
        ) : null}
        {application.sourceFilePath ? (
          <button onClick={() => void onApplyAiDraft(application)} type="button">
            <Sparkles aria-hidden size={15} />
            AI 초안 반영
          </button>
        ) : null}
        {activeTab === "planned" ? (
          <button className="job-detail-actions__primary" onClick={() => void onApply(application)} type="button">
            지원으로 전환
          </button>
        ) : null}
      </div>

      <section className="job-detail-section">
        <div className="job-detail-section__heading">
          <span>전형 일정</span>
          <small>{activeTab === "planned" ? "지원으로 전환하면 캘린더에 반영됩니다." : "단계별 진행 상태를 관리합니다."}</small>
        </div>
        <div className="job-detail-manage-form">
          <select value={stepForm.type} onChange={(event) => setStepForm((current) => ({ ...current, type: event.target.value as JobApplicationStep["type"] }))}>
            {defaultJobProcessStepTypes.map((type) => <option key={type} value={type}>{jobProcessStepLabels[type]}</option>)}
          </select>
          <input value={stepForm.title} placeholder="전형명" onChange={(event) => setStepForm((current) => ({ ...current, title: event.target.value }))} />
          <input type="datetime-local" value={stepForm.startAt} onChange={(event) => setStepForm((current) => ({ ...current, startAt: event.target.value }))} />
          <input type="datetime-local" value={stepForm.endAt} onChange={(event) => setStepForm((current) => ({ ...current, endAt: event.target.value }))} />
          <textarea rows={2} value={stepForm.memo} placeholder="메모" onChange={(event) => setStepForm((current) => ({ ...current, memo: event.target.value }))} />
          <div className="job-detail-inline-actions">
            <button disabled={!stepForm.title.trim()} onClick={() => {
              void onSaveStep(application.id, {
                ...stepForm,
                startAt: toIsoFromDatetimeLocal(stepForm.startAt),
                endAt: toIsoFromDatetimeLocal(stepForm.endAt),
              }, editingStepId ?? undefined);
              resetStepForm();
            }} type="button">{editingStepId ? "일정 수정" : "일정 추가"}</button>
            {editingStepId ? <button onClick={resetStepForm} type="button">취소</button> : null}
          </div>
        </div>
        {application.steps.length > 0 ? (
          <div className="job-detail-step-list">
            {application.steps.map((step) => (
              <article className="job-detail-step" key={step.id}>
                <b>{jobProcessStepLabels[step.type]}</b>
                <strong>{step.title}</strong>
                <small>{formatJobStepRange(step) || "날짜 확인 필요"}</small>
                {step.sourceText ? <em>{step.sourceText}</em> : null}
                <div className="job-detail-item-actions">
                  <button aria-label="일정 수정" onClick={() => startEditStep(step)} type="button"><Pencil aria-hidden size={13} /></button>
                  <button aria-label="일정 삭제" onClick={() => void onDeleteStep(application.id, step.id)} type="button"><Trash2 aria-hidden size={13} /></button>
                </div>
                {activeTab === "applied" ? (
                  <select value={step.status} onChange={(event) => onStepStatusChange(application.id, step.id, event.target.value as JobApplicationStep["status"])}>
                    <option value="confirmed">예정</option>
                    <option value="done">완료</option>
                    <option value="skipped">건너뜀</option>
                  </select>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="job-detail-empty">PDF 초안에서 추출된 일정이 없습니다.</div>
        )}
      </section>

      <section className="job-detail-section">
        <div className="job-detail-section__heading">
          <span>지원 요건/가점</span>
          <small>자격증 매칭은 다음 단계에서 연결합니다.</small>
        </div>
        <div className="job-detail-manage-form">
          <select value={requirementForm.category} onChange={(event) => setRequirementForm((current) => ({ ...current, category: event.target.value as JobApplicationRequirement["category"] }))}>
            <option value="eligibility">지원자격</option>
            <option value="preferred">우대/가점</option>
            <option value="document">서류</option>
            <option value="exam">필기</option>
            <option value="interview">면접</option>
            <option value="note">메모</option>
          </select>
          <input value={requirementForm.title} placeholder="항목명" onChange={(event) => setRequirementForm((current) => ({ ...current, title: event.target.value }))} />
          <textarea rows={3} value={requirementForm.content} placeholder="내용" onChange={(event) => setRequirementForm((current) => ({ ...current, content: event.target.value }))} />
          <div className="job-detail-inline-actions">
            <button disabled={!requirementForm.title.trim()} onClick={() => {
              void onSaveRequirement(application.id, requirementForm, editingRequirementId ?? undefined);
              resetRequirementForm();
            }} type="button">{editingRequirementId ? "요건 수정" : "요건 추가"}</button>
            {editingRequirementId ? <button onClick={resetRequirementForm} type="button">취소</button> : null}
          </div>
        </div>
        {application.requirements.length > 0 ? (
          <div className="job-detail-requirements">
            {application.requirements.map((requirement) => (
              <article key={requirement.id}>
                <b>{requirement.title}</b>
                <p>{requirement.content}</p>
                {requirement.sourceText ? <em>{requirement.sourceText}</em> : null}
                <div className="job-detail-item-actions">
                  <button aria-label="요건 수정" onClick={() => startEditRequirement(requirement)} type="button"><Pencil aria-hidden size={13} /></button>
                  <button aria-label="요건 삭제" onClick={() => void onDeleteRequirement(application.id, requirement.id)} type="button"><Trash2 aria-hidden size={13} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="job-detail-empty">지원 요건 정보가 아직 없습니다.</div>
        )}
      </section>

      {application.checkItems.length > 0 ? (
        <section className="job-detail-section">
          <div className="job-detail-section__heading">
            <span>준비 체크</span>
          </div>
          <div className="job-detail-checks">
            {application.checkItems.map((item) => (
              <span key={item.id}>
                <CheckCircle2 aria-hidden size={15} />
                {item.title}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="job-detail-meta">
      <span>{label}</span>
      <strong>{value}</strong>
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.details, maybeError.code].filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length > 0) return parts.join(" ");
  }
  return fallback;
}

function JobPostingUploadSheet({
  onClose,
  onSaveJobPosting,
}: {
  onClose: () => void;
  onSaveJobPosting: (extraction: JobPostingExtraction, file?: { path?: string; name?: string }) => Promise<void> | void;
}) {
  const [postingFile, setPostingFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [postingTitle, setPostingTitle] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [aiDraft, setAiDraft] = useState<JobPostingExtraction | null>(null);
  const [uploadedPostingFile, setUploadedPostingFile] = useState<{ path?: string; name?: string } | null>(null);
  const [aiError, setAiError] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const extractPostingDraft = async () => {
    if (!postingFile) return;
    setAiError("");
    setIsExtracting(true);

    try {
      const payload = new FormData();
      payload.append("file", postingFile);
      payload.append("companyName", companyName);
      payload.append("postingTitle", postingTitle);
      payload.append("jobRole", jobRole);

      const response = await fetch("/api/career/extract-posting", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "PDF 분석에 실패했습니다.");

      const extraction = result as JobPostingExtraction;
      const uploadedFile = await uploadJobPostingFileToDb(postingFile);
      setUploadedPostingFile(uploadedFile);
      await createAiExtractionDraftInDb({
        extraction,
        modelName: extraction.modelName,
        sourceFileName: uploadedFile?.name ?? postingFile.name,
        sourceFilePath: uploadedFile?.path,
      });
      setAiDraft(extraction);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "PDF 분석에 실패했습니다.");
    } finally {
      setIsExtracting(false);
    }
  };

  const saveDraftAsJobPosting = async () => {
    if (!aiDraft) return;
    setAiError("");
    setIsSaving(true);
    try {
      await onSaveJobPosting(aiDraft, uploadedPostingFile ?? undefined);
    } catch (error) {
      setAiError(getErrorMessage(error, "전형 공고 저장에 실패했습니다. Supabase 정책이나 테이블 구성을 확인해주세요."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="posting-upload-sheet-title" aria-modal="true" className="event-sheet career-sheet job-posting-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header career-sheet__header">
          <div>
            <h2 id="posting-upload-sheet-title">PDF로 공고 분석</h2>
            <p>채용공고 PDF에서 전형 일정과 준비 항목을 뽑아 초안을 만듭니다. 저장 전에는 직접 확인합니다.</p>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button"><X aria-hidden size={18} /></button>
        </header>
        <div className="event-sheet__body career-sheet__body">
          <AppliedAiPostingPanel
            aiDraft={aiDraft}
            aiError={aiError}
            companyName={companyName}
            isExtracting={isExtracting}
            isSaving={isSaving}
            jobRole={jobRole}
            postingFile={postingFile}
            postingTitle={postingTitle}
            onCompanyNameChange={setCompanyName}
            onExtractPostingDraft={() => void extractPostingDraft()}
            onJobRoleChange={setJobRole}
            onPostingFileChange={setPostingFile}
            onPostingTitleChange={setPostingTitle}
            onSaveDraft={saveDraftAsJobPosting}
          />
        </div>
      </section>
    </div>
  );
}

function ManualJobApplicationSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (payload: { companyName: string; postingTitle: string; jobRole: string; postingUrl?: string; memo?: string }) => Promise<void> | void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [postingTitle, setPostingTitle] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [postingUrl, setPostingUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = Boolean(companyName.trim() && postingTitle.trim());

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({ companyName, postingTitle, jobRole, postingUrl, memo });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="manual-job-sheet-title" aria-modal="true" className="event-sheet career-sheet manual-job-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header career-sheet__header">
          <div><h2 id="manual-job-sheet-title">지원 기업 직접 추가</h2></div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button"><X aria-hidden size={18} /></button>
        </header>
        <div className="event-sheet__body career-sheet__body manual-job-sheet__body">
          <div className="event-form-card career-field-card career-form-card manual-job-form">
            <div className="career-form-card__fields">
              <div className="career-primary-fields">
                <label><span>기업명</span><input autoFocus placeholder="한국전력공사" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
                <label><span>공고명</span><input placeholder="2026년도 상반기 4직급 대졸수준" value={postingTitle} onChange={(event) => setPostingTitle(event.target.value)} /></label>
              </div>
              <Field label="직무" placeholder="ICT" value={jobRole} onChange={setJobRole} />
              <Field label="공고 URL" placeholder="https://..." value={postingUrl} onChange={setPostingUrl} />
              <label className="event-note"><span>메모</span><textarea rows={5} placeholder="관심 사유, 준비할 내용, 확인해야 할 조건을 적어두세요." value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
            </div>
          </div>
        </div>
        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">취소</button>
          <button className="event-sheet__primary-button" disabled={!canSave || isSaving} onClick={() => void save()} type="button">{isSaving ? "저장 중" : "지원 예정으로 저장"}</button>
        </footer>
      </section>
    </div>
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
      id: "career-" + Date.now(),
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
      const uploadedFile = form.tab === "certificates" && certificateFile ? await uploadCertificateFileToDb(certificateFile, form.id, form.certificateFilePath) : null;
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
      <section aria-labelledby="career-sheet-title" aria-modal="true" className={"event-sheet career-sheet career-sheet--" + form.tab} role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header career-sheet__header">
          <div><h2 id="career-sheet-title">{record ? tabLabels[form.tab] + " 수정" : tabLabels[form.tab] + " 추가"}</h2></div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button"><X aria-hidden size={18} /></button>
        </header>
        <div className="event-sheet__body career-sheet__body">
          <div className="event-form-card career-field-card career-form-card">
            <div className="career-form-card__title"><strong>자격 정보</strong></div>
            <div className="career-form-card__fields">
              <div className="career-primary-fields">
                <label><span>{getTitleLabel(form.tab)}</span><input autoFocus placeholder={getTitlePlaceholder(form.tab)} value={form.title} onChange={(event) => updateField("title", event.target.value)} /></label>
                <label><span>{getSubtitleLabel(form.tab)}</span><input placeholder={getSubtitlePlaceholder(form.tab)} value={form.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} /></label>
              </div>
              <label className="event-form-row event-form-row--select"><span>상태</span><select value={form.status || getDefaultStatus(form.tab)} onChange={(event) => updateField("status", event.target.value)}>{getStatusOptions(form.tab, form.status).map((status) => (<option key={status} value={status}>{status}</option>))}</select></label>
              <CareerSpecificFields form={form} selectedCertificateFile={certificateFile} updateField={updateField} onCertificateFileChange={setCertificateFile} />
              <label className="event-note"><span>메모</span><textarea rows={4} placeholder="준비 내용, 참고사항, 다음 액션을 적어두세요." value={form.memo ?? ""} onChange={(event) => updateField("memo", event.target.value)} /></label>
            </div>
          </div>
        </div>
        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">취소</button>
          <button className="event-sheet__primary-button" disabled={isSaving} onClick={() => void saveCurrentRecord()} type="button">{isSaving ? "저장 중" : "저장하기"}</button>
        </footer>
      </section>
    </div>
  );
}

function AppliedAiPostingPanel({
  aiDraft,
  aiError,
  companyName,
  isExtracting,
  isSaving,
  jobRole,
  onApplyAiDraft,
  onCompanyNameChange,
  onExtractPostingDraft,
  onJobRoleChange,
  onPostingFileChange,
  onPostingTitleChange,
  onSaveDraft,
  postingFile,
  postingTitle,
}: {
  aiDraft: JobPostingExtraction | null;
  aiError: string;
  companyName: string;
  isExtracting: boolean;
  isSaving: boolean;
  jobRole: string;
  onApplyAiDraft?: () => void;
  onCompanyNameChange: (value: string) => void;
  onExtractPostingDraft: () => void;
  onJobRoleChange: (value: string) => void;
  onPostingFileChange: (file: File | null) => void;
  onPostingTitleChange: (value: string) => void;
  onSaveDraft: () => Promise<void> | void;
  postingFile: File | null;
  postingTitle: string;
}) {
  return (
    <div className="career-ai-panel-stack">
      <div className="career-ai-uploader">
        <div className="career-ai-uploader__copy">
          <span>공고 PDF</span>
          <strong>PDF로 전형 초안 만들기</strong>
          <p>공고 파일을 선택하면 AI가 일정, 지원자격, 준비물을 검토용 초안으로 정리합니다.</p>
        </div>
        <div className="career-ai-uploader__actions">
          <div className="career-ai-uploader__fields">
            <label>
              <span>기업명</span>
              <input value={companyName} placeholder="한국전력공사" onChange={(event) => onCompanyNameChange(event.target.value)} />
            </label>
            <label>
              <span>공고명</span>
              <input value={postingTitle} placeholder="2026년도 상반기 4직급 대졸수준" onChange={(event) => onPostingTitleChange(event.target.value)} />
            </label>
            <label>
              <span>지원 직무</span>
              <input value={jobRole} placeholder="ICT" onChange={(event) => onJobRoleChange(event.target.value)} />
            </label>
          </div>
          <label className="career-ai-file-button">
            파일 선택
            <input accept="application/pdf,.pdf" type="file" onChange={(event) => onPostingFileChange(event.target.files?.[0] ?? null)} />
          </label>
          <button disabled={!postingFile || isExtracting} onClick={onExtractPostingDraft} type="button">
            <Sparkles aria-hidden size={15} />
            {isExtracting ? "분석 중" : "AI 초안 생성"}
          </button>
        </div>
        <div className="career-ai-uploader__file">{postingFile ? postingFile.name : "선택된 PDF가 없습니다."}</div>
        {isExtracting ? <small className="career-ai-uploader__hint">보통 30초 안팎이지만, PDF가 크거나 Gemini 응답이 느리면 최대 75초 뒤 자동으로 중단됩니다.</small> : null}
        {aiError ? <small className="career-ai-uploader__error">{aiError}</small> : null}
      </div>
      {aiDraft ? <AiDraftReview draft={aiDraft} isSaving={isSaving} onApply={onApplyAiDraft} onSave={onSaveDraft} /> : null}
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

function AiDraftReview({
  draft,
  isSaving,
  onApply,
  onSave,
}: {
  draft: JobPostingExtraction;
  isSaving: boolean;
  onApply?: () => void;
  onSave: () => Promise<void> | void;
}) {
  return (
    <div className="ai-draft-review">
      <div className="ai-draft-review__header">
        <div>
          <span>AI 검토 초안</span>
          <strong>{draft.companyName || "기업명 미확인"}</strong>
          <div className="ai-draft-summary-grid">
            <DetailMeta label="공고" value={draft.postingTitle || "공고명 확인 필요"} />
            <DetailMeta label="지원 직무" value={draft.jobRole || "직무 확인 필요"} />
            <DetailMeta label="추출 일정" value={`${draft.steps.length}개`} />
            <DetailMeta label="요건/가점" value={`${draft.requirements.length}개`} />
          </div>
        </div>
        <div className="ai-draft-review__actions">
          {onApply ? (
            <button type="button" onClick={onApply}>
              폼에 반영
            </button>
          ) : null}
          <button disabled={isSaving} type="button" onClick={() => void onSave()}>
            {isSaving ? "저장 중" : "지원 예정으로 저장"}
          </button>
        </div>
      </div>

      <div className="ai-draft-review__section">
        <span>전형 일정</span>
        {draft.steps.length > 0 ? (
          <div className="ai-draft-step-list">
            {draft.steps.map((step, index) => (
              <div className="ai-draft-step" key={`${step.type}-${step.title}-${index}`}>
                <b>{jobProcessStepLabels[step.type]}</b>
                <strong>{step.title}</strong>
                <small>{formatDraftRange(step.startAt, step.endAt) || "날짜 확인 필요"}</small>
                {step.memo ? <p>{step.memo}</p> : null}
                {step.sourceText ? <em>{step.sourceText}</em> : null}
              </div>
            ))}
          </div>
        ) : (
          <p>전형 일정이 추출되지 않았습니다.</p>
        )}
      </div>

      <div className="ai-draft-review__section">
        <span>준비/자격</span>
        <div className="ai-draft-chip-list">
          {[...draft.requirements, ...draft.checkItems].map((item, index) => (
            <span key={`${item.title}-${index}`}>
              <b>{item.title}</b>
              {"content" in item ? item.content : item.memo}
            </span>
          ))}
        </div>
      </div>

      {draft.warnings.length > 0 ? (
        <div className="ai-draft-review__warnings">
          {draft.warnings.map((warning) => (
            <span key={warning}>확인 필요: {warning}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
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

async function openJobPostingFile(path?: string) {
  if (!path) return;
  const url = await getJobPostingFileDownloadUrl(path);
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

function findDraftStep(draft: JobPostingExtraction, type: JobProcessStepType) {
  return draft.steps.find((step) => step.type === type);
}

function toDateInputValue(value?: string) {
  if (!value) return undefined;
  const dateOnly = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return dateOnly;
}

function toDatetimeLocalValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoFromDatetimeLocal(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function draftStepToApplicationEvent(step: NonNullable<ReturnType<typeof findDraftStep>>, stage: ApplicationEventStage): ApplicationEvent | null {
  const date = toDateInputValue(step.startAt ?? step.endAt);
  if (!date) return null;

  return {
    id: `application-event-${stage}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    stage,
    date,
    memo: step.memo || step.title,
  };
}

function extractRequirementText(draft: JobPostingExtraction, category: "eligibility" | "document") {
  const values = draft.requirements
    .filter((requirement) => requirement.category === category)
    .map((requirement) => `${requirement.title}: ${requirement.content}`)
    .slice(0, 4);

  return values.length > 0 ? values.join("\n") : undefined;
}

function formatDraftRange(startAt?: string, endAt?: string) {
  const start = formatDraftDateTime(startAt);
  const end = formatDraftDateTime(endAt);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end;
}

function formatDraftDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(date);
}

function formatJobStepRange(step: JobApplicationStep) {
  const start = formatDraftDateTime(step.startAt);
  const end = formatDraftDateTime(step.endAt);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end || "날짜 미정";
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
