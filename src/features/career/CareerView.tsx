"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, FileBadge, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { careerRecords, type CareerRecord, type CareerTab } from "./data";

const tabLabels: Record<CareerTab, string> = {
  applications: "지원 기업",
  planned: "지원 예정",
  certificates: "자격증",
};

const tabIcons = {
  applications: BriefcaseBusiness,
  planned: Target,
  certificates: FileBadge,
};

export function CareerView() {
  const [records, setRecords] = useState<CareerRecord[]>(careerRecords);
  const [activeTab, setActiveTab] = useState<CareerTab>("applications");
  const [editingRecord, setEditingRecord] = useState<CareerRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const visibleRecords = useMemo(() => records.filter((record) => record.tab === activeTab), [activeTab, records]);

  return (
    <div className="career-page">
      <header className="page-header career-header">
        <div>
          <h1>취업</h1>
          <div className="today__date">
            <BriefcaseBusiness aria-hidden size={20} />
            <span>지원 기업, 지원 예정 기업, 자격증을 관리합니다.</span>
          </div>
        </div>
        <button className="header-action" onClick={() => {
          setEditingRecord(null);
          setIsSheetOpen(true);
        }}>
          <Plus aria-hidden size={18} />
          항목 추가
        </button>
      </header>

      <div className="career-tabs" aria-label="취업 카테고리">
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
            <BriefcaseBusiness aria-hidden size={20} />
            <span>{tabLabels[activeTab]}</span>
          </div>
        </div>

        <div className="career-record-list">
          {visibleRecords.map((record) => (
            <article className="career-record-card" key={record.id}>
              <div>
                <Badge tone={activeTab === "certificates" ? "green" : "amber"}>{record.status}</Badge>
                <h3>{record.title}</h3>
                <p>{record.subtitle}</p>
                <span>{record.dateLabel}</span>
                {record.memo ? <small>{record.memo}</small> : null}
              </div>
              <div className="record-actions">
                <button onClick={() => {
                  setEditingRecord(record);
                  setIsSheetOpen(true);
                }}>
                  <Pencil aria-hidden size={15} />
                  수정
                </button>
                <button onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}>
                  <Trash2 aria-hidden size={15} />
                  삭제
                </button>
              </div>
            </article>
          ))}
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
              return exists ? current.map((item) => item.id === record.id ? record : item) : [record, ...current];
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
  const [tab, setTab] = useState<CareerTab>(record?.tab ?? activeTab);
  const [title, setTitle] = useState(record?.title ?? "");
  const [subtitle, setSubtitle] = useState(record?.subtitle ?? "");
  const [dateLabel, setDateLabel] = useState(record?.dateLabel ?? "");
  const [status, setStatus] = useState(record?.status ?? "");
  const [memo, setMemo] = useState(record?.memo ?? "");

  const saveRecord = () => {
    if (!title.trim()) return;
    onSave({
      id: record?.id ?? `career-${Date.now()}`,
      tab,
      title: title.trim(),
      subtitle: subtitle.trim() || "상세 없음",
      dateLabel: dateLabel.trim() || "날짜 미정",
      status: status.trim() || "준비 중",
      memo: memo.trim() || undefined,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="career-sheet-title" aria-modal="true" className="event-sheet career-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>취소</button>
          <h2 id="career-sheet-title">{record ? "항목 수정" : "항목 추가"}</h2>
          <button className="event-sheet__done-button" onClick={saveRecord}>저장</button>
        </header>
        <div className="event-sheet__body">
          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
              <span>분류</span>
              <select value={tab} onChange={(event) => setTab(event.target.value as CareerTab)}>
                <option value="applications">지원 기업</option>
                <option value="planned">지원 예정</option>
                <option value="certificates">자격증</option>
              </select>
            </label>
          </div>
          <div className="event-form-card event-form-card--title">
            <label>
              <span>이름</span>
              <input autoFocus placeholder="기업명 또는 자격증명" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>상세</span>
              <input placeholder="직무, 공고명, 발급기관 등" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
            </label>
          </div>
          <div className="event-form-card">
            <label className="event-form-row event-form-row--field">
              <span>날짜</span>
              <input placeholder="마감 5/26 23:59" value={dateLabel} onChange={(event) => setDateLabel(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field">
              <span>상태</span>
              <input placeholder="지원 완료, 관심, 보유..." value={status} onChange={(event) => setStatus(event.target.value)} />
            </label>
            <label className="event-note">
              <span>메모</span>
              <textarea rows={4} placeholder="준비할 내용, 링크, 필요한 서류" value={memo} onChange={(event) => setMemo(event.target.value)} />
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
