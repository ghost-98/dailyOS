import { buildRecordPeopleSummaries, buildRecordSearchItems, getTopCounts, parseCompanions, type RecordSearchItem } from "@/features/records/search/recordsInsights";
import type { RecordDataSnapshot } from "@/features/records/state/recordsDataLoader";
import { buildMemorySemanticMetadata, expandMemoryQuestion, getDocumentSemanticText } from "@/features/memory-conversation/memorySemantics";
import type { MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

const DOCUMENT_LIMIT = 700;

export function buildMemoryDocuments(data: RecordDataSnapshot): MemoryDocument[] {
  const searchItems = buildRecordSearchItems(data.events, data.tasks, data.activities, data.expenses, data.incomes, data.dailyLogs, data.lifePhotos, data.weights, data.workouts);
  const recordDocuments = searchItems.map(recordSearchItemToMemoryDocument);
  const summaryDocuments = [
    ...buildDailySummaryDocuments(searchItems),
    ...buildPersonSummaryDocuments(data),
    ...buildPlaceSummaryDocuments(searchItems),
    ...buildMonthSummaryDocuments(searchItems),
  ];

  return [...recordDocuments, ...summaryDocuments]
    .sort((left, right) => right.date.localeCompare(left.date) || left.kind.localeCompare(right.kind))
    .slice(0, DOCUMENT_LIMIT);
}

export function buildMemorySummaries(documents: MemoryDocument[]): MemorySummary[] {
  const recentDocuments = documents
    .filter((document) => !document.kind.endsWith("_summary"))
    .slice(0, 80);
  const recentText = summarizeDocumentGroup("최근 기록 흐름", recentDocuments);

  const monthSummaries = groupBy(documents.filter((document) => !document.kind.endsWith("_summary")), (document) => document.date.slice(0, 7))
    .slice(0, 6)
    .map(([month, items]) => ({
      id: `month:${month}`,
      kind: "month" as const,
      periodEnd: `${month}-31`,
      periodStart: `${month}-01`,
      text: summarizeDocumentGroup(`${month} 월간 기억`, items.slice(0, 60)),
    }));

  const personSummaries = groupBy(documents.filter((document) => Array.isArray(document.metadata.people)), (document) => (document.metadata.people as string[]).join(", "))
    .filter(([people]) => people)
    .slice(0, 10)
    .map(([people, items]) => ({
      id: `person:${people}`,
      kind: "person" as const,
      subject: people,
      text: summarizeDocumentGroup(`${people} 관련 기억`, items.slice(0, 30)),
    }));

  return [
    { id: "recent", kind: "recent", text: recentText },
    ...monthSummaries,
    ...personSummaries,
  ];
}

export function selectConversationMemory(question: string, documents: MemoryDocument[], summaries: MemorySummary[], recentMessages: Array<{ content: string; role: string }>) {
  const expandedQuestion = expandMemoryQuestion(question);
  const terms = getQuestionTerms(expandedQuestion);
  const scoredDocuments = documents
    .map((document) => ({ document, score: scoreDocument(expandedQuestion, terms, document) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.document.date.localeCompare(left.document.date))
    .map((item) => item.document);

  const selectedDocuments = dedupeDocuments([
    ...scoredDocuments.slice(0, 28),
    ...documents.filter((document) => !document.kind.endsWith("_summary")).slice(0, 24),
    ...documents.filter((document) => document.kind.endsWith("_summary")).slice(0, 12),
  ]).slice(0, 46);

  const selectedSummaries = summaries
    .map((summary) => ({ summary, score: scoreText(expandedQuestion, terms, [summary.text, summary.subject, summary.periodStart, summary.periodEnd].filter(Boolean).join(" ")) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((item) => item.summary);

  return {
    documents: selectedDocuments,
    messages: recentMessages.slice(-10),
    summaries: selectedSummaries,
  };
}

export function buildLocalMemoryAnswer(question: string, documents: MemoryDocument[], summaries: MemorySummary[]) {
  const selected = selectConversationMemory(question, documents, summaries, []);
  const topDocuments = selected.documents.slice(0, 8);
  const overview = selected.summaries[0]?.text ?? summarizeDocumentGroup("관련 기억", topDocuments);
  const evidence = topDocuments.slice(0, 6).map((document) => ({
    date: document.date,
    focusId: document.focusId,
    id: document.id,
    label: document.label,
    reason: getEvidenceReason(question, document),
    title: document.title,
  }));
  const answerLines = [
    `질문을 기준으로 ${topDocuments.length}개의 관련 기록을 먼저 봤어요.`,
    overview,
    ...topDocuments.slice(0, 5).map((document) => `- ${document.date} · ${document.label} · ${document.title}: ${document.text}`),
  ];

  return {
    answer: answerLines.join("\n"),
    evidence,
    followups: buildFollowups(question, topDocuments),
    mode: "local" as const,
    summary: overview,
  };
}

function recordSearchItemToMemoryDocument(item: RecordSearchItem): MemoryDocument {
  const facts = item.facts?.map((fact) => fact.text) ?? [];
  const semanticMetadata = buildMemorySemanticMetadata(item);
  const text = [item.date, item.label, item.title, item.description, ...facts, item.tags.join(" "), semanticMetadata.semanticTags.join(" "), semanticMetadata.semanticAliases.join(" ")].filter(Boolean).join(" · ");
  return {
    date: item.date,
    focusId: item.focusId ?? item.id,
    id: `${item.type}:${item.id}`,
    kind: item.type,
    label: item.label,
    metadata: {
      facts,
      tags: item.tags,
      type: item.type,
      people: extractPeople(item),
      places: extractPlaces(item),
      ...semanticMetadata,
    },
    sourceId: item.id,
    sourceType: item.type,
    text,
    title: item.title,
  };
}

function buildDailySummaryDocuments(items: RecordSearchItem[]) {
  return groupBy(items, (item) => item.date).slice(0, 180).map(([date, records]) => ({
    date,
    id: `daily-summary:${date}`,
    kind: "daily_summary" as const,
    label: "하루 요약",
    metadata: { count: records.length },
    sourceId: date,
    sourceType: "daily_summary",
    text: summarizeRecordSearchItems(`${date} 하루`, records),
    title: `${date} 하루 요약`,
  }));
}

function buildPersonSummaryDocuments(data: RecordDataSnapshot) {
  return buildRecordPeopleSummaries(data.events, data.tasks, data.activities, data.expenses, data.dailyLogs, data.lifePhotos).slice(0, 80).map((person) => ({
    date: person.items[0]?.date ?? "",
    id: `person-summary:${person.name}`,
    kind: "person_summary" as const,
    label: "사람 기억",
    metadata: { count: person.items.length, expenseTotal: person.expenseTotal, places: person.places },
    sourceId: person.name,
    sourceType: "person_summary",
    text: `${person.name} 관련 기록 ${person.items.length}건. 자주 연결된 장소: ${person.places.slice(0, 6).join(", ") || "없음"}. 최근 기록: ${person.items.slice(0, 8).map((item) => `${item.date} ${item.title}`).join(" / ")}`,
    title: `${person.name} 기억`,
  }));
}

function buildPlaceSummaryDocuments(items: RecordSearchItem[]) {
  const placeRecords = new Map<string, RecordSearchItem[]>();
  items.forEach((item) => {
    extractPlaces(item).forEach((place) => {
      const current = placeRecords.get(place) ?? [];
      current.push(item);
      placeRecords.set(place, current);
    });
  });
  return [...placeRecords.entries()]
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 80)
    .map(([place, records]) => ({
      date: records[0]?.date ?? "",
      id: `place-summary:${place}`,
      kind: "place_summary" as const,
      label: "장소 기억",
      metadata: { count: records.length, place },
      sourceId: place,
      sourceType: "place_summary",
      text: `${place} 관련 기록 ${records.length}건. 최근 기록: ${records.slice(0, 8).map((item) => `${item.date} ${item.title}`).join(" / ")}`,
      title: `${place} 기억`,
    }));
}

function buildMonthSummaryDocuments(items: RecordSearchItem[]) {
  return groupBy(items, (item) => item.date.slice(0, 7)).slice(0, 24).map(([month, records]) => ({
    date: `${month}-01`,
    id: `month-summary:${month}`,
    kind: "month_summary" as const,
    label: "월간 기억",
    metadata: { count: records.length, month },
    sourceId: month,
    sourceType: "month_summary",
    text: summarizeRecordSearchItems(`${month} 월간`, records.slice(0, 80)),
    title: `${month} 월간 요약`,
  }));
}

function summarizeRecordSearchItems(title: string, records: RecordSearchItem[]) {
  const labels = getTopCounts(records.map((record) => record.label));
  const people = getTopCounts(records.flatMap(extractPeople)).slice(0, 6);
  const places = getTopCounts(records.flatMap(extractPlaces)).slice(0, 6);
  return [
    `${title}: 기록 ${records.length}건`,
    `유형: ${labels.slice(0, 5).map((item) => `${item.name} ${item.count}`).join(", ") || "없음"}`,
    `사람: ${people.map((item) => `${item.name} ${item.count}`).join(", ") || "없음"}`,
    `장소: ${places.map((item) => `${item.name} ${item.count}`).join(", ") || "없음"}`,
    `최근: ${records.slice(0, 8).map((record) => `${record.date} ${record.title}`).join(" / ")}`,
  ].join("\n");
}

function summarizeDocumentGroup(title: string, documents: MemoryDocument[]) {
  if (documents.length === 0) return `${title}: 관련 기록이 아직 충분하지 않습니다.`;
  const labels = getTopCounts(documents.map((document) => document.label)).slice(0, 6);
  const people = getTopCounts(documents.flatMap((document) => Array.isArray(document.metadata.people) ? document.metadata.people as string[] : [])).slice(0, 6);
  const places = getTopCounts(documents.flatMap((document) => Array.isArray(document.metadata.places) ? document.metadata.places as string[] : [])).slice(0, 6);
  return [
    `${title}: ${documents.length}개의 기억을 기준으로 봤습니다.`,
    `주요 유형은 ${labels.map((item) => `${item.name} ${item.count}건`).join(", ") || "아직 뚜렷하지 않음"}입니다.`,
    people.length > 0 ? `자주 등장한 사람은 ${people.map((item) => item.name).join(", ")}입니다.` : "",
    places.length > 0 ? `자주 등장한 장소는 ${places.map((item) => item.name).join(", ")}입니다.` : "",
  ].filter(Boolean).join(" ");
}

function scoreDocument(question: string, terms: string[], document: MemoryDocument) {
  const text = [document.date, document.label, document.title, getDocumentSemanticText(document), JSON.stringify(document.metadata)].join(" ");
  let score = scoreText(question, terms, text);
  if (question.includes("요즘") || question.includes("최근")) score += Math.max(0, 4 - Math.min(4, dateDistanceScore(document.date)));
  if (isFoodRecallQuestion(question) && document.kind === "activity") score += 5;
  if (isFoodRecallQuestion(question) && /음식|식비|식당|카페|레스토랑|맛집|먹/.test(normalize(text))) score += 4;
  if (document.kind.endsWith("_summary")) score += 1;
  return score;
}

function scoreText(question: string, terms: string[], text: string) {
  const normalized = normalize(text);
  let score = 0;
  terms.forEach((term) => {
    if (normalized.includes(term)) score += term.length >= 4 ? 4 : 2;
  });
  if ((question.includes("돈") || question.includes("소비") || question.includes("지출")) && /지출|수입|원|식비|교통/.test(normalized)) score += 5;
  if ((question.includes("누구") || question.includes("사람")) && /함께한 사람|사람 기억/.test(normalized)) score += 4;
  if ((question.includes("어디") || question.includes("장소")) && /장소|주소|장소 기억/.test(normalized)) score += 4;
  if ((question.includes("운동") || question.includes("건강")) && /운동|러닝|몸무게|건강/.test(normalized)) score += 4;
  if (isFoodRecallQuestion(question) && /음식|식비|식당|카페|레스토랑|맛집|먹/.test(normalized)) score += 5;
  return score;
}

function getQuestionTerms(question: string) {
  const stopWords = new Set(["나는", "내가", "나랑", "기반", "기록", "요즘", "최근", "이번", "지난", "어떻게", "뭐야", "뭐였지", "알려줘", "정리해줘"]);
  const baseTerms = normalize(question)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !stopWords.has(term));
  return [...new Set(baseTerms.flatMap(expandQuestionTerm))];
}

function expandQuestionTerm(term: string) {
  const expanded = [term];
  const suffixes = ["음식", "요리", "식당", "레스토랑", "카페"];
  suffixes.forEach((suffix) => {
    if (term.endsWith(suffix) && term.length > suffix.length + 1) {
      expanded.push(term.slice(0, -suffix.length), suffix);
    }
  });
  if (term.includes("스페인")) expanded.push("스페인", "스페인음식", "스페인요리");
  return expanded.filter((value) => value.length >= 2);
}

function isFoodRecallQuestion(question: string) {
  return /먹|음식|요리|식당|레스토랑|맛집|카페/.test(question);
}

function extractPeople(item: RecordSearchItem) {
  const text = [item.description, item.tags.join(" "), item.facts?.map((fact) => fact.text).join(" ")].join(" ");
  const match = text.match(/함께한 사람\s*·\s*([^·]+)/);
  return parseCompanions(match?.[1]);
}

function extractPlaces(item: RecordSearchItem) {
  const places = new Set<string>();
  item.facts?.filter((fact) => fact.kind === "place").forEach((fact) => {
    const first = fact.text.split("·")[0]?.trim();
    if (first) places.add(first);
  });
  item.tags.filter((tag) => tag.length > 1 && !/^\d/.test(tag)).slice(0, 3).forEach((tag) => {
    if (/로|길|동|역|점|카페|식당|센터|학교|회사|집/.test(tag)) places.add(tag);
  });
  return [...places];
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  });
  return [...groups.entries()].sort((left, right) => right[0].localeCompare(left[0]));
}

function dedupeDocuments(documents: MemoryDocument[]) {
  const seen = new Set<string>();
  return documents.filter((document) => {
    if (seen.has(document.id)) return false;
    seen.add(document.id);
    return true;
  });
}

function dateDistanceScore(date: string) {
  const time = Date.parse(date);
  if (Number.isNaN(time)) return 99;
  return Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24 * 30));
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function getEvidenceReason(question: string, document: MemoryDocument) {
  const terms = getQuestionTerms(question);
  const matched = terms.filter((term) => normalize(document.text).includes(term)).slice(0, 3);
  if (matched.length > 0) return `질문 표현(${matched.join(", ")})과 직접 맞닿은 기록`;
  if (document.kind.endsWith("_summary")) return "여러 기록을 압축한 장기 기억";
  return "최근 맥락을 보강하는 원본 기록";
}

function buildFollowups(question: string, documents: MemoryDocument[]) {
  const hasMoney = question.includes("돈") || question.includes("소비") || question.includes("지출");
  const hasPeople = question.includes("사람") || question.includes("누구");
  const hasRecent = question.includes("요즘") || question.includes("최근");
  return [
    hasMoney ? "이 소비가 반복되는 패턴인지 봐줘" : "이 흐름에서 반복되는 패턴을 찾아줘",
    hasPeople ? "사람별로 더 자세히 나눠줘" : "관련된 사람 기준으로 다시 정리해줘",
    hasRecent ? "이전 달과 비교해줘" : "최근 기록만 기준으로 다시 말해줘",
    documents[0]?.date ? `${documents[0].date} 하루를 더 자세히 풀어줘` : "근거 기록을 더 보여줘",
  ];
}
