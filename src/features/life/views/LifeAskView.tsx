"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/features/calendar/data";
import { requestLifeAskAnswer } from "@/features/life/ask/client";
import { buildLifeAskAnalysis } from "@/features/life/askInsights";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { buildLifeSearchItems, selectRelevantLifeAskRecords } from "@/features/life/insights";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";
import { SectionCard } from "@/components/ui/SectionCard";

type LifeAskViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  onOpenDate: (date: string) => void;
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

const exampleQuestions = [
  "지난달에 누구를 가장 자주 만났고 돈은 어디에 많이 썼어?",
  "3월에 운동한 날과 소비가 어떤 관계가 있었어?",
  "최근에 자주 간 장소와 그때 했던 일을 요약해줘",
];

export function LifeAskView({
  activities,
  dailyLogs,
  events,
  expenses,
  incomes,
  onOpenDate,
  photos,
  tasks,
  weights,
  workouts,
}: LifeAskViewProps) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [question, setQuestion] = useState("나 3월달에 자주 했던 일과 그때의 소비, 사람, 건강 흐름이 어땠어?");

  const records = useMemo(() => buildLifeSearchItems(events, tasks, activities, expenses, incomes, dailyLogs, photos, weights, workouts), [activities, dailyLogs, events, expenses, incomes, photos, tasks, weights, workouts]);
  const scopedRecords = useMemo(() => selectRelevantLifeAskRecords(question, records), [question, records]);
  const analysis = useMemo(
    () =>
      buildLifeAskAnalysis({
        activities,
        events,
        expenses,
        incomes,
        logs: dailyLogs,
        photos,
        question,
        scopedRecords,
        tasks,
        weights,
        workouts,
      }),
    [activities, dailyLogs, events, expenses, incomes, photos, question, scopedRecords, tasks, weights, workouts],
  );

  const askLifeDb = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    try {
      setIsAsking(true);
      setError("");
      setAnswer("");
      const nextAnswer = await requestLifeAskAnswer({
        analysis,
        question: trimmedQuestion,
        records: scopedRecords.map((record) => ({
          date: record.date,
          description: record.description,
          label: record.label,
          tags: record.tags,
          title: record.title,
          type: record.type,
        })),
      });
      setAnswer(nextAnswer);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "AI 질문 처리 중 오류가 발생했습니다.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="AI 질문" description="쌓인 일정, 할 일, 하루기록, 사진, 장소, 지출, 건강 기록을 근거로 자연어 질문에 답합니다." />
      <div className="life-ask-layout">
        <SectionCard className="life-ask-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Life DB Copilot</p>
              <h2>내 기록에 질문하기</h2>
            </div>
            <strong className="life-places-count">{scopedRecords.length}/{records.length}건</strong>
          </div>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 나 3월달에 부산 갔던 것 같은데 그때 어땠어?" />
          <div className="life-ask-examples">
            {exampleQuestions.map((example) => (
              <button key={example} onClick={() => setQuestion(example)} type="button">
                {example}
              </button>
            ))}
          </div>
          <button className="life-ask-submit" disabled={isAsking || !question.trim()} onClick={() => void askLifeDb()} type="button">
            {isAsking ? "기록 읽는 중..." : "AI에게 물어보기"}
          </button>
          {error ? <p className="life-ask-error">{error}</p> : null}
        </SectionCard>

        <SectionCard className="life-ask-answer">
          <p className="eyebrow">AI Answer</p>
          <div className="life-ask-brief">
            <article className="life-ask-overview-card">
              <span>{analysis.focusTitle}</span>
              <strong>{analysis.overview}</strong>
              <p>{analysis.focusDescription}</p>
            </article>

            <div className="life-ask-metric-grid">
              {analysis.cards.map((card) => (
                <article key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  {card.meta ? <p>{card.meta}</p> : null}
                </article>
              ))}
            </div>

            <div className="life-ask-link-groups">
              {analysis.linkGroups.map((group) => (
                <article className="life-ask-link-group" key={group.title}>
                  <div className="life-ask-link-group__head">
                    <span>{group.title}</span>
                  </div>
                  <div className="life-ask-link-group__items">
                    {group.items.map((item) => (
                      <button className="life-ask-link-item" key={`${group.title}-${item.label}-${item.date}`} onClick={() => onOpenDate(item.date)} type="button">
                        <strong>{item.label}</strong>
                        <span>{item.meta ?? item.date}</span>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="life-ask-answer-block">
              <div className="life-ask-answer-block__head">
                <p className="eyebrow">답변</p>
                <span>{scopedRecords.length}건 기준</span>
              </div>
              {answer ? (
                <div className="life-ask-answer__body">{answer}</div>
              ) : (
                <div className="life-map-empty life-map-empty--compact">
                  <Search aria-hidden size={28} />
                  <strong>아직 질문하지 않았습니다.</strong>
                  <p>질문을 입력하고 답변 생성을 누르면 이 영역에 길이 제한 없이 답변이 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
