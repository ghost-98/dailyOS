import type { MemoryQuestionPlan } from "@/features/memory-conversation/conversationPolicy";
import type { MemoryConversationMessage, MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

export function buildMemoryAnswerPrompt(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
  questionPlan: MemoryQuestionPlan,
) {
  return [
    "너는 dailyOS의 개인 기록 기반 대화 엔진이다.",
    "제공된 기록과 요약 메모리를 근거로 자연스럽게 답한다. 근거 없는 사실을 만들지 않는다.",
    "답변 본문에는 근거 목록을 길게 반복하지 않는다. 근거는 evidence 필드에 분리해서 담는다.",
    "질문 성격에 따라 답변 방식을 조절한다. 분석형 질문은 숫자, 기간, 사람, 장소, 유형을 먼저 분리해서 근거 중심으로 답한다.",
    "기록이 부족하면 부족하다고 말하되, 가능한 범위에서 패턴과 다음 질문을 제안한다.",
    "답변은 한국어로 자연스럽고 개인 비서처럼 필요한 말만 한다.",
    "반드시 JSON만 반환한다. 형식: {\"answer\":\"...\",\"summary\":\"...\",\"evidence\":[{\"id\":\"...\",\"title\":\"...\",\"date\":\"...\",\"label\":\"...\",\"reason\":\"...\"}],\"followups\":[\"...\"]}",
    "",
    `질문: ${question}`,
    `질문 처리 계획: intent=${questionPlan.intent}, domain=${questionPlan.domain}, range=${questionPlan.dateRange.label}, keywords=${questionPlan.keywords.join(", ") || "없음"}`,
    "",
    "최근 대화:",
    messages.length > 0 ? messages.map((message) => `${message.role}: ${message.content}`).join("\n") : "없음",
    "",
    "장기 요약 메모리:",
    summaries.length > 0 ? summaries.map((summary) => `- [${summary.kind}] ${summary.subject ?? summary.periodStart ?? summary.id}: ${summary.text}`).join("\n") : "없음",
    "",
    "관련 원본 기억:",
    documents.map((document) => `- id=${document.id} / ${document.date} / ${document.label} / ${document.title}\n${document.text}`).join("\n\n"),
  ].join("\n");
}

export function buildGeneralChatPrompt(question: string, messages: MemoryConversationMessage[]) {
  return [
    "너는 dailyOS의 개인 기록 대화 도우미다.",
    "이번 질문은 특정 개인 기록 조회가 아니라 일반 대화다. 기록을 검색했다고 말하지 말고, 없는 근거를 만들지 않는다.",
    "너의 역할은 사용자가 dailyOS에 쌓은 활동, 장소, 하루기록, 사진, 소비, 건강 데이터를 나중에 자연어로 돌아보고 분석하도록 돕는 것이다.",
    "친근하되 과장하지 말고, 한국어로 짧고 자연스럽게 답한다. 질문에 필요한 말만 한다.",
    "반드시 JSON만 반환한다. 형식: {\"answer\":\"...\",\"summary\":\"...\",\"evidence\":[],\"followups\":[\"...\"]}",
    "",
    "최근 대화:",
    messages.length > 0 ? messages.slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n") : "없음",
    "",
    `사용자 질문: ${question}`,
  ].join("\n");
}
