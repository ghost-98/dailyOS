"use client";

import { useMemo, useState } from "react";
import type React from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileBadge,
  FileText,
  LinkIcon,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { careerRecords, type CareerRecord, type CareerTab } from "./data";

const tabLabels: Record<CareerTab, string> = {
  applied: "지원한 공기업",
  planned: "지원 예정",
  certificates: "자격증",
  resumes: "이력서",
};

const tabDescriptions: Record<CareerTab, string> = {
  applied: "지원일, 마감일, 시험, 면접, 결과 발표까지 한 번에 봅니다.",
  planned: "관심 기업과 준비해야 할 자격증, 서류를 미리 정리합니다.",
  certificates: "보유 자격증, 번호, 발급 기관, 만료일, PDF 링크를 관리합니다.",
  resumes: "공기업 지원용 이력서와 자기소개서 버전을 관리합니다.",
};

const tabIcons = {
  applied: BriefcaseBusiness,
  planned: Target,
  certificates: FileBadge,
  resumes: FileText,
};

const priorityLabels = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

export function CareerView() {
  const [records, setRecords] = useState<CareerRecord[]>(careerRecords);
  const [activeTab, setActiveTab] = useState<CareerTab>("applied");
  const [editingRecord, setEditingRecord] = useState<CareerRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const visibleRecords = useMemo(() => records.filter((record) => record.tab === activeTab), [activeTab, records]);
  const nextDeadline = useMemo(
    () =>
      records
        .filter((record) => record.tab === "applied" && record.deadlineDate)
        .sort((a, b) => String(a.deadlineDate).localeCompare(String(b.deadlineDate)))[0],
    [records],
  );

  const openNewSheet = (tab = activeTab) => {
    setActiveTab(tab);
    setEditingRecord(null);
    setIsSheetOpen(true);
  };

  return (
    <div className="career-page">
      <header className="page-header career-header">
        <div>
          <h1>취업</h1>
          <div className="today__date">
            <BriefcaseBusiness aria-hidden size={20} />
            <span>자격증, 공기업 지원 현황, 지원 예정 기업, 이력서를 관리합니다.</span>
          </div>
        </div>
        <button className="header-action" onClick={() => openNewSheet()}>
          <Plus aria-hidden size={18} />
          항목 추가
        </button>
      </header>

      <section className="career-overview" aria-label="취업 관리 요약">
        <SectionCard className="career-overview-card">
          <span>진행 중 지원</span>
          <strong>{records.filter((record) => record.tab === "applied").length}</strong>
          <p>{nextDeadline ? `${nextDeadline.title} 마감 ${formatDisplayDate(nextDeadline.deadlineDate)}` : "다가오는 마감 없음"}</p>
        </SectionCard>
        <SectionCard className="career-overview-card">
          <span>보유 자격증</span>
          <strong>{records.filter((record) => record.tab === "certificates").length}</strong>
          <p>번호, 만료일, PDF 링크까지 함께 보관</p>
        </SectionCard>
        <SectionCard className="career-overview-card">
          <span>이력서 버전</span>
          <strong>{records.filter((record) => record.tab === "resumes").length}</strong>
          <p>지원 기업별로 연결해서 추적</p>
        </SectionCard>
      </section>

      <div className="career-tabs" aria-label="취업 관리 분류">
        {(Object.keys(tabLabels) as CareerTab[]).map((tab) => {
          const Icon = tabIcons[tab];
          const count = records.filter((record) => record.tab === tab).length;
          return (
            <button className={activeTab === tab ? "career-tab career-tab--active" : "career-tab"} key={tab} onClick={() => setActiveTab(tab)}>
              <Icon aria-hidden size={18} />
              {tabLabels[tab]}
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

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
              onDelete={() => setRecords((current) => current.filter((item) => item.id !== record.id))}
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
              <p>추가 버튼으로 지금 관리할 항목을 등록해보세요.</p>
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
          onSave={(record) => {
            setRecords((current) => {
              const exists = current.some((item) => item.id === record.id);
              return exists ? current.map((item) => (item.id === record.id ? record : item)) : [record, ...current];
            });
            setActiveTab(record.tab);
            setEditingRecord(null);
            setIsSheetOpen(false);
          }}
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
        <CareerMeta record={record} />
        {record.url ? (
          <a className="career-link" href={record.url} rel="noreferrer" target="_blank">
            <LinkIcon aria-hidden size={14} />
            링크 열기
          </a>
        ) : null}
        {record.memo ? <small>{record.memo}</small> : null}
      </div>
      <div className="record-actions">
        <button onClick={onEdit}>
          <Pencil aria-hidden size={15} />
          수정
        </button>
        <button onClick={onDelete}>
          <Trash2 aria-hidden size={15} />
          삭제
        </button>
      </div>
    </article>
  );
}

function CareerMeta({ record }: { record: CareerRecord }) {
  if (record.tab === "applied") {
    return (
      <div className="career-meta-grid">
        <MetaItem icon={<CalendarClock aria-hidden size={14} />} label="지원" value={record.primaryDate} />
        <MetaItem label="마감" value={record.deadlineDate} />
        <MetaItem label="시험" value={record.examDate} />
        <MetaItem label="면접" value={record.interviewDate} />
        <MetaItem label="결과" value={record.resultDate} />
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
    return (
      <div className="career-meta-grid">
        <MetaItem label="자격증 번호" value={record.certificateNumber} />
        <MetaItem label="발급 기관" value={record.issuer ?? record.subtitle} />
        <MetaItem label="취득일" value={record.primaryDate} />
        <MetaItem label="만료일" value={record.deadlineDate} />
        <MetaItem label="점수" value={record.score} />
        <MetaItem label="등급" value={record.grade} />
      </div>
    );
  }

  return (
    <div className="career-meta-grid">
      <MetaItem label="용도" value={record.subtitle} />
      <MetaItem label="최근 수정" value={record.primaryDate} />
      <MetaItem label="상태" value={record.status} />
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
    },
  );

  const updateField = <Key extends keyof CareerRecord>(key: Key, value: CareerRecord[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveRecord = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || getDefaultSubtitle(form.tab),
      status: form.status.trim() || getDefaultStatus(form.tab),
      memo: form.memo?.trim() || undefined,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="career-sheet-title"
        aria-modal="true"
        className="event-sheet career-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>
            취소
          </button>
          <h2 id="career-sheet-title">{record ? "항목 수정" : "항목 추가"}</h2>
          <button className="event-sheet__done-button" onClick={saveRecord}>
            저장
          </button>
        </header>
        <div className="event-sheet__body">
          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
              <span>분류</span>
              <select value={form.tab} onChange={(event) => updateField("tab", event.target.value as CareerTab)}>
                <option value="applied">지원한 공기업</option>
                <option value="planned">지원 예정</option>
                <option value="certificates">자격증</option>
                <option value="resumes">이력서</option>
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
            <label className="event-form-row event-form-row--field">
              <span>상태</span>
              <input placeholder={getDefaultStatus(form.tab)} value={form.status} onChange={(event) => updateField("status", event.target.value)} />
            </label>
            <CareerSpecificFields form={form} updateField={updateField} />
            <label className="event-note">
              <span>메모</span>
              <textarea rows={4} placeholder="준비할 내용, 체크 포인트, 보완할 문항을 적어두세요." value={form.memo ?? ""} onChange={(event) => updateField("memo", event.target.value)} />
            </label>
          </div>
        </div>
        <button className="event-sheet__floating-close" aria-label="닫기" onClick={onClose}>
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
        <Field label="사용 이력서" value={form.resumeName} onChange={(value) => updateField("resumeName", value)} />
      </>
    );
  }

  if (form.tab === "planned") {
    return (
      <>
        <Field label="예상 채용 시기" value={form.primaryDate} placeholder="2026 하반기" onChange={(value) => updateField("primaryDate", value)} />
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
        <Field label="자격증 번호" value={form.certificateNumber} onChange={(value) => updateField("certificateNumber", value)} />
        <Field label="발급 기관" value={form.issuer} onChange={(value) => updateField("issuer", value)} />
        <Field label="취득일" type="date" value={form.primaryDate} onChange={(value) => updateField("primaryDate", value)} />
        <Field label="만료일" type="date" value={form.deadlineDate} onChange={(value) => updateField("deadlineDate", value)} />
        <Field label="점수" value={form.score} onChange={(value) => updateField("score", value)} />
        <Field label="등급" value={form.grade} onChange={(value) => updateField("grade", value)} />
        <Field label="PDF 파일/URL" value={form.url} onChange={(value) => updateField("url", value)} />
      </>
    );
  }

  return (
    <>
      <Field label="최근 수정일" type="date" value={form.primaryDate} onChange={(value) => updateField("primaryDate", value)} />
      <Field label="파일/URL" value={form.url} onChange={(value) => updateField("url", value)} />
    </>
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
  if (record.tab === "resumes") return "violet";
  if (record.status.includes("마감") || record.status.includes("준비")) return "amber";
  return "muted";
}

function getDefaultSubtitle(tab: CareerTab) {
  if (tab === "applied" || tab === "planned") return "직무 미정";
  if (tab === "certificates") return "발급 기관 미입력";
  return "이력서 용도 미입력";
}

function getDefaultStatus(tab: CareerTab) {
  if (tab === "applied") return "지원 준비";
  if (tab === "planned") return "관심";
  if (tab === "certificates") return "보유";
  return "작성 중";
}

function getTitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "자격증명";
  if (tab === "resumes") return "문서명";
  return "기업명";
}

function getTitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "정보처리기사";
  if (tab === "resumes") return "공기업 ICT 기본 이력서 v3";
  return "한국전력공사";
}

function getSubtitleLabel(tab: CareerTab) {
  if (tab === "certificates") return "발급 기관";
  if (tab === "resumes") return "용도";
  return "직무 / 공고명";
}

function getSubtitlePlaceholder(tab: CareerTab) {
  if (tab === "certificates") return "한국산업인력공단";
  if (tab === "resumes") return "전산직 공통";
  return "ICT 운영 / 전산직";
}

function formatDisplayDate(value?: string) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
