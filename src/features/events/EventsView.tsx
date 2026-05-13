"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarClock, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { eventCategoryLabels, personalEvents, type PersonalEvent } from "./data";

const categoryTone: Record<PersonalEvent["category"], "violet" | "green" | "pink" | "amber" | "muted"> = {
  deadline: "amber",
  exam: "pink",
  meeting: "violet",
  personal: "green",
  career: "amber",
  etc: "muted",
};

export function EventsView() {
  const [events, setEvents] = useState<PersonalEvent[]>(personalEvents);
  const [editingEvent, setEditingEvent] = useState<PersonalEvent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`)),
    [events],
  );

  return (
    <div className="events-page">
      <header className="page-header">
        <div>
          <h1>이벤트</h1>
          <div className="today__date">
            <Bell aria-hidden size={20} />
            <span>마감, 시험, 면접, 설명회처럼 일정과 할 일 사이에 있는 날짜 중심 항목을 관리합니다.</span>
          </div>
        </div>
        <button
          className="header-action"
          onClick={() => {
            setEditingEvent(null);
            setIsSheetOpen(true);
          }}
        >
          <Plus aria-hidden size={18} />
          이벤트 추가
        </button>
      </header>

      <SectionCard className="events-card">
        <div className="section-heading">
          <div className="card-title">
            <CalendarClock aria-hidden size={20} />
            <span>다가오는 이벤트</span>
          </div>
        </div>

        <div className="event-record-list">
          {sortedEvents.map((event) => (
            <article className="event-record-card" key={event.id}>
              <div>
                <Badge tone={categoryTone[event.category]}>{eventCategoryLabels[event.category]}</Badge>
                <h3>{event.title}</h3>
                <p>{formatDate(event.date)}{event.time ? ` ${event.time}` : ""} · {event.source}</p>
                {event.memo ? <small>{event.memo}</small> : null}
              </div>
              <div className="record-actions">
                <button
                  onClick={() => {
                    setEditingEvent(event);
                    setIsSheetOpen(true);
                  }}
                >
                  <Pencil aria-hidden size={15} />
                  수정
                </button>
                <button onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}>
                  <Trash2 aria-hidden size={15} />
                  삭제
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      {isSheetOpen ? (
        <EventSheet
          event={editingEvent}
          onClose={() => {
            setEditingEvent(null);
            setIsSheetOpen(false);
          }}
          onSave={(event) => {
            setEvents((current) => {
              const exists = current.some((item) => item.id === event.id);
              return exists ? current.map((item) => (item.id === event.id ? event : item)) : [event, ...current];
            });
            setEditingEvent(null);
            setIsSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function EventSheet({
  event,
  onClose,
  onSave,
}: {
  event: PersonalEvent | null;
  onClose: () => void;
  onSave: (event: PersonalEvent) => void;
}) {
  const [form, setForm] = useState<PersonalEvent>(
    event ?? {
      id: `event-${Date.now()}`,
      title: "",
      date: new Date().toISOString().slice(0, 10),
      time: "",
      category: "personal",
      source: "직접 등록",
      memo: "",
    },
  );

  const saveEvent = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      title: form.title.trim(),
      time: form.time || undefined,
      memo: form.memo?.trim() || undefined,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="personal-event-title" aria-modal="true" className="event-sheet" role="dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>취소</button>
          <h2 id="personal-event-title">{event ? "이벤트 수정" : "이벤트 추가"}</h2>
          <button className="event-sheet__done-button" onClick={saveEvent}>저장</button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card event-form-card--title">
            <label>
              <span>제목</span>
              <input autoFocus placeholder="정보처리기사 원서접수" value={form.title} onChange={(changeEvent) => setForm((current) => ({ ...current, title: changeEvent.target.value }))} />
            </label>
            <label>
              <span>메모</span>
              <input placeholder="확인할 것, 준비물, 링크 등" value={form.memo ?? ""} onChange={(changeEvent) => setForm((current) => ({ ...current, memo: changeEvent.target.value }))} />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--field">
              <span>날짜</span>
              <input type="date" value={form.date} onChange={(changeEvent) => setForm((current) => ({ ...current, date: changeEvent.target.value }))} />
            </label>
            <label className="event-form-row event-form-row--field">
              <span>시간</span>
              <input type="time" value={form.time ?? ""} onChange={(changeEvent) => setForm((current) => ({ ...current, time: changeEvent.target.value }))} />
            </label>
            <label className="event-form-row event-form-row--select">
              <span>분류</span>
              <select value={form.category} onChange={(changeEvent) => setForm((current) => ({ ...current, category: changeEvent.target.value as PersonalEvent["category"] }))}>
                <option value="deadline">마감</option>
                <option value="exam">시험</option>
                <option value="meeting">약속</option>
                <option value="personal">개인</option>
                <option value="career">취업</option>
                <option value="etc">기타</option>
              </select>
            </label>
            <label className="event-form-row event-form-row--select">
              <span>출처</span>
              <select value={form.source} onChange={(changeEvent) => setForm((current) => ({ ...current, source: changeEvent.target.value as PersonalEvent["source"] }))}>
                <option value="직접 등록">직접 등록</option>
                <option value="취업">취업</option>
                <option value="자격증">자격증</option>
                <option value="건강">건강</option>
              </select>
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

function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  return `${value.getMonth() + 1}/${value.getDate()}`;
}
