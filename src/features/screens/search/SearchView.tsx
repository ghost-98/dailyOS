"use client";

import { Banknote, Brain, CalendarRange, Camera, CheckCircle2, Clock, Database, Dumbbell, MapPin, NotebookPen, Search, Send, Tag, UsersRound, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildRecordSearchItems, type RecordSearchFactKind } from "@/features/records/search/recordsInsights";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { createDayRecordHref } from "@/features/records/navigation/recordDeepLink";
import { PeriodFilterSheet } from "@/components/shared/date/PeriodFilterSheet";
import { buildMemoryDocuments, buildMemorySummaries } from "@/features/memory-conversation/memoryDocuments";
import type { MemoryChatResponse, MemoryConversationMessage } from "@/features/memory-conversation/types";
import { createMemoryConversation, fetchMemoryMessages, saveMemoryMessage, syncMemoryDocumentsToDb } from "@/features/data/memory/api";
import { supabase } from "@/lib/supabase";

export function SearchView() {
  const router = useRouter();
  const { data } = useRecordsDataState();
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "ask">("search");
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MemoryConversationMessage[]>([]);
  const [answer, setAnswer] = useState<MemoryChatResponse | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState<"idle" | "syncing" | "ready" | "local" | "error">("idle");
  const [memoryError, setMemoryError] = useState("");
  const [askError, setAskError] = useState("");

  const items = useMemo(
    () => buildRecordSearchItems(data.events, data.tasks, data.activities, data.expenses, data.incomes, data.dailyLogs, data.lifePhotos, data.weights, data.workouts),
    [data.activities, data.dailyLogs, data.events, data.expenses, data.incomes, data.lifePhotos, data.tasks, data.weights, data.workouts],
  );
  const memoryDocuments = useMemo(() => buildMemoryDocuments(data), [data]);
  const memorySummaries = useMemo(() => buildMemorySummaries(memoryDocuments), [memoryDocuments]);

  useEffect(() => {
    if (memoryDocuments.length === 0) return;
    let isMounted = true;
    setMemoryStatus("syncing");
    setMemoryError("");
    syncMemoryDocumentsToDb(memoryDocuments, memorySummaries)
      .then(() => { if (isMounted) setMemoryStatus("ready"); })
      .catch((error) => {
        console.error("Failed to sync memory documents", error);
        if (isMounted) {
          setMemoryStatus("error");
          setMemoryError(error instanceof Error ? error.message : "메모리 동기화에 실패했습니다.");
        }
      });
    return () => { isMounted = false; };
  }, [memoryDocuments, memorySummaries]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const filteredItems = hasQuery
    ? items.filter((item) => {
        const matchesQuery = [item.title, item.description, item.date, item.tags.join(" "), item.facts?.map((fact) => fact.text).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
        const matchesStart = !startDate || item.date >= startDate;
        const matchesEnd = !endDate || item.date <= endDate;
        return matchesQuery && matchesStart && matchesEnd;
      })
    : [];

  const resultCount = filteredItems.length;

  const ask = async (nextQuestion = question) => {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion || isAsking) return;
    setQuestion(trimmedQuestion);
    setAskError("");
    setIsAsking(true);
    setMode("ask");
    setQuestion("");

    const optimisticUserMessage: MemoryConversationMessage = {
      content: trimmedQuestion,
      createdAt: new Date().toISOString(),
      id: `local-user-${Date.now()}`,
      role: "user",
    };
    setMessages((current) => [...current, optimisticUserMessage]);

    try {
      const activeConversationId = conversationId ?? (await createMemoryConversation(trimmedQuestion.slice(0, 48)))?.id ?? null;
      if (activeConversationId && !conversationId) {
        setConversationId(activeConversationId);
        const existingMessages = await fetchMemoryMessages(activeConversationId);
        if (existingMessages.length > 0) setMessages(existingMessages);
      }
      if (activeConversationId) await saveMemoryMessage(activeConversationId, "user", trimmedQuestion);

      const accessToken = await getAccessToken();
      const response = await fetch("/api/memory/chat", {
        body: JSON.stringify({
          documents: memoryDocuments,
          messages: [...messages, optimisticUserMessage].slice(-10),
          question: trimmedQuestion,
          summaries: memorySummaries,
        }),
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) throw new Error("기록 기반 답변을 만들지 못했습니다.");
      const nextAnswer = await response.json() as MemoryChatResponse;
      setAnswer(nextAnswer);
      setIsEvidenceOpen(false);
      const assistantMessage: MemoryConversationMessage = {
        content: nextAnswer.answer,
        createdAt: new Date().toISOString(),
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
      };
      setMessages((current) => [...current, assistantMessage]);
      if (activeConversationId) await saveMemoryMessage(activeConversationId, "assistant", nextAnswer.answer);
    } catch (error) {
      console.error("Failed to ask memory", error);
      setAskError(error instanceof Error ? error.message : "답변 생성에 실패했습니다.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="life-tab-panel">
      <div className="life-search-shell">
        <div className="life-search-mode-switch" role="tablist" aria-label="검색 모드">
          <button aria-selected={mode === "search"} className={mode === "search" ? "life-search-mode-switch__item life-search-mode-switch__item--active" : "life-search-mode-switch__item"} onClick={() => setMode("search")} role="tab" type="button">
            <Search aria-hidden size={15} />
            <span>검색</span>
          </button>
          <button aria-selected={mode === "ask"} className={mode === "ask" ? "life-search-mode-switch__item life-search-mode-switch__item--active" : "life-search-mode-switch__item"} onClick={() => setMode("ask")} role="tab" type="button">
            <Brain aria-hidden size={15} />
            <span>기록 대화</span>
          </button>
        </div>

        {mode === "ask" ? (
          <div className="life-ask-layout">
            <section className="life-ask-chat">
              <div className="life-ask-chat__status">
                <span><Database aria-hidden size={14} /> {getMemoryStatusLabel(memoryStatus)}</span>
                <strong>{memoryDocuments.length}개 기억</strong>
              </div>
              {memoryError ? <p className="life-ask-error">{memoryError}</p> : null}

              <div className="life-ask-thread" aria-label="기록 대화">
                {messages.length > 0 ? (
                  messages.slice(-12).map((message) => (
                    <article className={`life-ask-thread__message life-ask-thread__message--${message.role}`} key={message.id}>
                      <span>{message.role === "user" ? "나" : "dailyOS"}</span>
                      <p>{message.content}</p>
                    </article>
                  ))
                ) : (
                  <div className="life-map-empty life-map-empty--compact">
                    <Brain aria-hidden size={28} />
                    <strong>기록을 기억처럼 꺼내 대화합니다.</strong>
                    <p>활동, 하루기록, 사진, 사람, 장소, 소비, 건강 데이터를 근거로 답해요.</p>
                  </div>
                )}
                {isAsking ? (
                  <article className="life-ask-thread__message life-ask-thread__message--assistant">
                    <span>dailyOS</span>
                    <p>기록을 살펴보고 있어요...</p>
                  </article>
                ) : null}
              </div>

              {answer ? (
                <div className="life-ask-insight-panel">
                  <div className="life-ask-insight-panel__head">
                    <strong>{answer.summary}</strong>
                    {(answer.evidence.length > 0 || answer.followups.length > 0) ? (
                      <button onClick={() => setIsEvidenceOpen((current) => !current)} type="button">
                        {isEvidenceOpen ? "근거 숨기기" : `근거 ${answer.evidence.length}개`}
                      </button>
                    ) : null}
                  </div>
                  {isEvidenceOpen ? (
                    <>
                      {answer.evidence.length > 0 ? (
                        <div className="life-ask-link-group">
                          <div className="life-ask-link-group__head"><span>근거 기록</span></div>
                          <div className="life-ask-link-group__items">
                            {answer.evidence.map((evidence) => (
                              <button className="life-ask-link-item" key={evidence.id} onClick={() => router.push(createDayRecordHref(evidence.date, evidence.focusId ?? evidence.id))} type="button">
                                <strong>{evidence.title}</strong>
                                <span>{evidence.date} · {evidence.label} · {evidence.reason}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {answer.followups.length > 0 ? (
                        <div className="life-ask-followups">
                          <div className="life-ask-followups__head"><span>이어 물어보기</span></div>
                          <div className="life-ask-followups__items">
                            {answer.followups.map((followup) => <button key={followup} onClick={() => void ask(followup)} type="button">{followup}</button>)}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : answer.evidence.length > 0 ? (
                    <div className="life-ask-evidence-preview">
                      <span>근거: {answer.evidence.slice(0, 2).map((evidence) => evidence.title).join(", ")}</span>
                    </div>
                  ) : null}
                  <div className="life-ask-answer__body">{answer.answer}</div>
                </div>
              ) : null}

              <div className="life-ask-composer" role="form" aria-label="기록 대화 질문 입력">
                <textarea
                  placeholder="기록에 대해 물어보세요. 예: 최근에 스페인음식 먹은 곳이 어디였지?"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void ask();
                  }}
                />
                <button className="life-ask-submit" aria-label="질문 보내기" disabled={!question.trim() || isAsking} onClick={() => void ask()} type="button">
                  <Send aria-hidden size={16} />
                </button>
              </div>
              {askError ? <p className="life-ask-error">{askError}</p> : null}
            </section>
          </div>
        ) : (
          <>
        <div className="life-search-controls life-search-controls--compact">
          <label className="life-search-controls__query">
            <Search aria-hidden size={18} />
            <input placeholder="검색어 입력" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className="life-search-period-button" aria-label="기간 설정" onClick={() => setIsPeriodOpen(true)} type="button">
            <CalendarRange aria-hidden size={16} />
          </button>
        </div>

        <div className="life-search-meta-row">
          <span>{startDate || endDate ? `${startDate || "처음"} ~ ${endDate || "현재"}` : "전체"}</span>
          <strong>{hasQuery ? `${resultCount}개` : "0개"}</strong>
        </div>

        <div className="life-search-divider" aria-hidden />

        <div className="life-search-results">
          {!hasQuery ? (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>검색어를 입력해 주세요.</strong>
              <p>검색어를 넣으면 날짜 조건에 맞는 결과만 보여드려요.</p>
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.slice(0, 80).map((item) => (
              <button className={`life-search-result life-search-result--${item.type}`} key={item.id} onClick={() => router.push(createDayRecordHref(item.date, item.id))} type="button">
                <span className="life-search-result__head">
                  <span className="life-search-result__title">
                    <strong>{item.title}</strong>
                    <span className="life-search-result__meta">
                      <time>{item.date}</time>
                      <b>{item.label}</b>
                    </span>
                  </span>
                </span>
                {getSearchFacts(item).length > 0 ? (
                  <span className="life-search-result__facts">
                    {getSearchFacts(item).map((fact) => {
                      const Icon = getSearchFactIcon(fact.kind);
                      return <small key={`${fact.kind}-${fact.text}`}><Icon aria-hidden size={13} /> <span>{fact.text}</span></small>;
                    })}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>검색 결과가 없습니다.</strong>
              <p>검색어와 기간을 바꿔 다시 찾아보세요.</p>
            </div>
          )}
        </div>

        <PeriodFilterSheet
          endDate={endDate}
          isOpen={isPeriodOpen}
          onClose={() => setIsPeriodOpen(false)}
          onEndDateChange={setEndDate}
          onReset={() => { setStartDate(""); setEndDate(""); }}
          onStartDateChange={setStartDate}
          startDate={startDate}
        />
          </>
        )}
      </div>
    </div>
  );
}

async function getAccessToken() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

function getMemoryStatusLabel(status: "idle" | "syncing" | "ready" | "local" | "error") {
  return {
    error: "메모리 동기화 지연",
    idle: "메모리 준비 중",
    local: "로컬 메모리 사용",
    ready: "장기 메모리 동기화됨",
    syncing: "장기 메모리 동기화 중",
  }[status];
}

function getSearchFacts(item: ReturnType<typeof buildRecordSearchItems>[number]) {
  return item.facts?.slice(0, 5) ?? [];
}

function getSearchFactIcon(kind: RecordSearchFactKind) {
  return {
    food: UtensilsCrossed,
    memo: NotebookPen,
    money: Banknote,
    people: UsersRound,
    photo: Camera,
    place: MapPin,
    status: CheckCircle2,
    tag: Tag,
    time: Clock,
    workout: Dumbbell,
  }[kind];
}
