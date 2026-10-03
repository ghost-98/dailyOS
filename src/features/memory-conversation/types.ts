import type { RecordSearchItem } from "@/features/records/search/recordsInsights";

export type MemoryDocumentKind = RecordSearchItem["type"] | "daily_summary" | "person_summary" | "place_summary" | "month_summary";

export type MemoryDocument = {
  date: string;
  focusId?: string;
  id: string;
  kind: MemoryDocumentKind;
  label: string;
  metadata: Record<string, string | number | boolean | string[] | null | undefined>;
  sourceId: string;
  sourceType: string;
  text: string;
  title: string;
};

export type MemorySummary = {
  id: string;
  kind: "day" | "week" | "month" | "person" | "place" | "recent";
  periodEnd?: string;
  periodStart?: string;
  subject?: string;
  text: string;
};

export type MemoryConversationMessage = {
  content: string;
  createdAt: string;
  id: string;
  role: "user" | "assistant";
};

export type MemoryEvidence = {
  date: string;
  focusId?: string;
  id: string;
  label: string;
  reason: string;
  title: string;
};

export type MemoryChatResponse = {
  answer: string;
  evidence: MemoryEvidence[];
  followups: string[];
  mode: "llm" | "local";
  summary: string;
};
