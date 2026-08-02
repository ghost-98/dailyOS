"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDateKey, formatMinutesLabel, parseTimeToMinutes } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatActivityTime, getActivityDurationMinutes } from "@/features/life/reconstruction";
import type { LifeActivityRecord } from "@/types/domain";

export type LifeActivityDraft = {
  date?: string;
  endTime?: string;
  title?: string;
  startTime?: string;
};

type ActivityTemplate = {
  category: string;
  title: string;
};

const ACTIVITY_CATEGORIES = ["식사", "이동", "작업", "공부", "만남", "운동", "휴식", "집안일", "기타"];
const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  { category: "식사", title: "식사" },
  { category: "이동", title: "이동" },
  { category: "작업", title: "프로젝트 작업" },
  { category: "공부", title: "공부" },
  { category: "만남", title: "사람 만남" },
  { category: "운동", title: "운동" },
  { category: "휴식", title: "휴식" },
];
const DEFAULT_CATEGORY = "기타";

export function LifeActivitiesView({
  activities,
  initialDraft,
  onDeleteActivity,
  onSaveActivity,
}: {
  activities: LifeActivityRecord[];
  initialDraft?: LifeActivityDraft;
  onDeleteActivity: (id: string) => Promise<void> | void;
  onSaveActivity: (activity: LifeActivityRecord) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<LifeActivityRecord | null>(null);
  const [date, setDate] = useState(initialDraft?.date ?? formatDateKey(new Date()));
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [hasTime, setHasTime] = useState(true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(initialDraft?.endTime));
  const [startTime, setStartTime] = useState(initialDraft?.startTime ?? getDefaultActivityTime());
  const [endTime, setEndTime] = useState(initialDraft?.endTime ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [companions, setCompanions] = useState("");
  const [food, setFood] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!initialDraft) return;
    setEditing(null);
    setDate(initialDraft.date ?? formatDateKey(new Date()));
    setHasTime(Boolean(initialDraft.startTime || initialDraft.endTime));
    setHasEndTime(Boolean(initialDraft.endTime));
    setStartTime(initialDraft.startTime ?? getDefaultActivityTime());
    setEndTime(initialDraft.endTime ?? "");
    setTitle(initialDraft.title ?? "");
    setFormError("");
  }, [initialDraft]);

  const selectedActivities = useMemo(
    () => activities.filter((activity) => activity.date === date).sort((left, right) => (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99")),
    [activities, date],
  );
  const selectedExpenseTotal = selectedActivities.reduce((sum, activity) => sum + (activity.expenseAmount ?? 0), 0);
  const selectedCoveredMinutes = selectedActivities.reduce((sum, activity) => sum + getActivityDurationMinutes(activity), 0);
  const connectedCount = selectedActivities.filter((activity) => activity.placeName || activity.companions || activity.food || activity.memo || activity.sourceId).length;

  const resetForm = () => {
    setEditing(null);
    setCategory(DEFAULT_CATEGORY);
    setHasTime(true);
    setHasEndTime(false);
    setStartTime(getDefaultActivityTime());
    setEndTime("");
    setTitle("");
    setPlaceName("");
    setPlaceAddress("");
    setCompanions("");
    setFood("");
    setExpenseAmount("");
    setMemo("");
    setFormError("");
  };

  const editActivity = (activity: LifeActivityRecord) => {
    setEditing(activity);
    setDate(activity.date);
    setCategory(activity.category ?? DEFAULT_CATEGORY);
    setHasTime(Boolean(activity.startTime));
    setHasEndTime(Boolean(activity.endTime));
    setStartTime(activity.startTime ?? getDefaultActivityTime());
    setEndTime(activity.endTime ?? "");
    setTitle(activity.title);
    setPlaceName(activity.placeName ?? "");
    setPlaceAddress(activity.placeAddress ?? "");
    setCompanions(activity.companions ?? "");
    setFood(activity.food ?? "");
    setExpenseAmount(activity.expenseAmount ? String(activity.expenseAmount) : "");
    setMemo(activity.memo ?? "");
    setFormError("");
  };

  const applyTemplate = (template: ActivityTemplate) => {
    setCategory(template.category);
    if (!title.trim()) setTitle(template.title);
  };

  const startNow = () => {
    setDate(formatDateKey(new Date()));
    setHasTime(true);
    setHasEndTime(false);
    setStartTime(getDefaultActivityTime());
    setEndTime("");
    setMessage("지금 시작하는 활동으로 맞췄어요.");
  };

  const finishRecent = () => {
    const endMinutes = parseTimeToMinutes(getDefaultActivityTime()) ?? 0;
    setDate(formatDateKey(new Date()));
    setHasTime(true);
    setHasEndTime(true);
    setStartTime(formatMinutesLabel(Math.max(0, endMinutes - 60)));
    setEndTime(formatMinutesLabel(endMinutes));
    setMessage("최근 1시간 활동으로 맞췄어요.");
  };

  const saveActivity = async () => {
    if (!title.trim()) return;
    if (hasTime && hasEndTime && startTime && endTime && endTime < startTime) {
      setFormError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      await onSaveActivity({
        id: editing?.id ?? `activity-${Date.now()}`,
        date,
        startTime: hasTime ? startTime || undefined : undefined,
        endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
        isAllDay: !hasTime,
        title: title.trim(),
        category,
        placeName: placeName.trim() || undefined,
        placeAddress: placeAddress.trim() || undefined,
        companions: companions.trim() || undefined,
        food: food.trim() || undefined,
        expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
        memo: memo.trim() || undefined,
        sourceId: editing?.sourceId,
        sourceTitle: editing?.sourceTitle,
        sourceType: editing?.sourceType,
      });
      setMessage(editing ? "활동 기록을 수정했어요." : "활동 기록을 저장했어요.");
      resetForm();
    } catch (error) {
      console.error("Failed to save life activity", error);
      setFormError(getLifeActionErrorMessage(error, "활동 기록을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteActivity = async (activity: LifeActivityRecord) => {
    setDeletingActivityId(activity.id);
    setFormError("");
    setMessage("");
    try {
      await onDeleteActivity(activity.id);
      if (editing?.id === activity.id) resetForm();
      setMessage("활동 기록을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete life activity", error);
      setFormError(getLifeActionErrorMessage(error, "활동 기록을 삭제하지 못했습니다."));
    } finally {
      setDeletingActivityId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="활동 기록" description="dailyOS의 핵심 입력입니다. 몇 시부터 몇 시까지 어디서 무엇을 했고, 누구와 있었고, 무엇을 먹고 썼는지 남깁니다." />
      <div className="life-activity-layout">
        <SectionCard className="life-activity-form">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Core Life Block</p>
              <h2>{editing ? "활동 수정" : "활동 추가"}</h2>
            </div>
            <div className="life-record-actions">
              <button onClick={startNow} type="button">지금 시작</button>
              <button onClick={finishRecent} type="button">방금 끝남</button>
              {editing ? <button onClick={resetForm} type="button">새 기록</button> : null}
            </div>
          </div>

          <div className="life-activity-quick-grid">
            {ACTIVITY_TEMPLATES.map((template) => (
              <button key={template.category} onClick={() => applyTemplate(template)} type="button">
                {template.category}
              </button>
            ))}
          </div>

          <div className="event-form-card event-form-card--title">
            <label>
              <span>무엇을 했나</span>
              <input placeholder="예: 점심 먹고 산책, 프로젝트 작업" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <div className="schedule-form-section-title">
            <strong>활동 유형</strong>
            <span>나중에 AI가 하루 패턴을 읽는 태그입니다.</span>
          </div>
          <div className="life-activity-template-grid">
            {ACTIVITY_CATEGORIES.map((item) => (
              <button className={category === item ? "life-activity-template life-activity-template--active" : "life-activity-template"} key={item} onClick={() => setCategory(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          <div className="schedule-form-section-title">
            <strong>날짜와 시간</strong>
            <span>공백 없는 하루 복원을 위해 시작 시간만이라도 남겨두는 것을 추천합니다.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-time-grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>기록 날짜</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>시작 시간</span>
              <input disabled={!hasTime} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            {hasEndTime ? (
              <label className="event-form-row event-form-row--field schedule-field">
                <span>종료 시간</span>
                <input disabled={!hasTime} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </label>
            ) : null}
            <div className="event-form-row event-form-row--field schedule-field schedule-toggle-row">
              <span>시간 옵션</span>
              <div className="schedule-option-toggle-group">
                <label className="schedule-option-toggle">
                  <input
                    checked={!hasTime}
                    type="checkbox"
                    onChange={(event) => {
                      setHasTime(!event.target.checked);
                      if (event.target.checked) {
                        setHasEndTime(false);
                        setEndTime("");
                      }
                    }}
                  />
                  시간 미정
                </label>
                <label className="schedule-option-toggle">
                  <input
                    checked={hasEndTime}
                    disabled={!hasTime}
                    type="checkbox"
                    onChange={(event) => {
                      setHasEndTime(event.target.checked);
                      if (!event.target.checked) setEndTime("");
                    }}
                  />
                  종료시간 설정
                </label>
              </div>
            </div>
          </div>

          <div className="schedule-form-section-title">
            <strong>장소와 사람</strong>
            <span>어디서 누구와 있었는지를 함께 저장합니다.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>장소명</span>
              <input placeholder="예: 성수동 카페" value={placeName} onChange={(event) => setPlaceName(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>주소/동선 메모</span>
              <input placeholder="예: 서울숲 근처" value={placeAddress} onChange={(event) => setPlaceAddress(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>함께한 사람</span>
              <input placeholder="쉼표로 구분" value={companions} onChange={(event) => setCompanions(event.target.value)} />
            </label>
          </div>

          <div className="schedule-form-section-title">
            <strong>먹은 것과 지출</strong>
            <span>활동에서 발생한 소비는 가계부로 자동 연결됩니다.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>먹은 것</span>
              <input placeholder="예: 라멘, 커피" value={food} onChange={(event) => setFood(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>지출</span>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>메모</span>
              <textarea placeholder="지금의 맥락이나 감정" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
          <button className="life-ask-submit" disabled={!title.trim() || isSaving} onClick={() => void saveActivity()} type="button">
            {isSaving ? "저장 중" : editing ? "활동 저장" : "활동 추가"}
          </button>
        </SectionCard>

        <SectionCard className="life-activity-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected Day</p>
              <h2>{date} 활동 {selectedActivities.length}개</h2>
            </div>
          </div>
          <div className="life-activity-day-summary">
            <article>
              <span>기록 시간</span>
              <strong>{selectedCoveredMinutes > 0 ? `${Math.round((selectedCoveredMinutes / 60) * 10) / 10}시간` : "-"}</strong>
            </article>
            <article>
              <span>활동 지출</span>
              <strong>{selectedExpenseTotal > 0 ? formatWon(selectedExpenseTotal) : "-"}</strong>
            </article>
            <article>
              <span>연결 밀도</span>
              <strong>{connectedCount}/{selectedActivities.length}</strong>
            </article>
          </div>
          {selectedActivities.length > 0 ? (
            selectedActivities.map((activity) => (
              <article className="life-activity-item" key={activity.id}>
                <div>
                  <span>{formatActivityTime(activity)} · {activity.category ?? "활동"}</span>
                  <strong>{activity.title}</strong>
                  <p>
                    {[
                      activity.sourceTitle ? `출처 · ${activity.sourceTitle}` : null,
                      activity.placeName,
                      activity.companions ? `함께 · ${activity.companions}` : null,
                      activity.food ? `식사 · ${activity.food}` : null,
                      activity.expenseAmount ? formatWon(activity.expenseAmount) : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="life-record-actions">
                  <button onClick={() => editActivity(activity)} type="button">수정</button>
                  <button disabled={deletingActivityId === activity.id} onClick={() => void deleteActivity(activity)} type="button">
                    {deletingActivityId === activity.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>이 날짜의 활동 기록이 없습니다.</strong>
              <p>공백 없는 하루를 만들려면 작은 행동도 활동으로 남겨보세요.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function getDefaultActivityTime() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  return formatMinutesLabel(now.getHours() * 60 + now.getMinutes());
}

function getLifeActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
