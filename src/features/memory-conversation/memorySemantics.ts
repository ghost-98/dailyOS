import type { MemoryDocument } from "@/features/memory-conversation/types";
import type { RecordSearchItem } from "@/features/records/search/recordsInsights";

type SemanticRule = {
  aliases: string[];
  cuisine?: string;
  tags: string[];
};

const SEMANTIC_RULES: SemanticRule[] = [
  { aliases: ["스페인", "스페인음식", "스페인요리", "빠에야", "파에야", "감바스", "타파스", "하몽", "츄러스"], cuisine: "스페인", tags: ["음식", "양식", "유럽음식", "스페인음식"] },
  { aliases: ["이탈리아", "이탈리안", "파스타", "피자", "리조또", "라자냐"], cuisine: "이탈리아", tags: ["음식", "양식", "유럽음식", "이탈리아음식"] },
  { aliases: ["프랑스", "프렌치", "비스트로", "와인바", "크루아상"], cuisine: "프랑스", tags: ["음식", "양식", "유럽음식", "프랑스음식"] },
  { aliases: ["중식", "중국", "짜장", "짬뽕", "마라", "훠궈", "딤섬"], cuisine: "중국", tags: ["음식", "아시아음식", "중국음식"] },
  { aliases: ["일식", "일본", "스시", "초밥", "라멘", "우동", "돈카츠", "이자카야"], cuisine: "일본", tags: ["음식", "아시아음식", "일본음식"] },
  { aliases: ["태국", "타이", "팟타이", "똠얌", "푸팟퐁"], cuisine: "태국", tags: ["음식", "아시아음식", "태국음식"] },
  { aliases: ["베트남", "쌀국수", "분짜", "반미"], cuisine: "베트남", tags: ["음식", "아시아음식", "베트남음식"] },
  { aliases: ["인도", "커리", "카레", "난", "탄두리"], cuisine: "인도", tags: ["음식", "아시아음식", "인도음식"] },
  { aliases: ["멕시코", "타코", "부리또", "퀘사디아", "나초"], cuisine: "멕시코", tags: ["음식", "양식", "멕시코음식"] },
  { aliases: ["한식", "한국", "국밥", "백반", "김치", "삼겹살", "갈비", "찌개"], cuisine: "한국", tags: ["음식", "한식"] },
  { aliases: ["브런치", "샐러드", "스테이크", "버거", "와인", "레스토랑"], tags: ["음식", "양식"] },
  { aliases: ["카페", "커피", "디저트", "케이크", "베이커리", "빵"], tags: ["음식", "카페", "디저트"] },
];

const FOOD_WORDS = ["먹", "음식", "요리", "식당", "레스토랑", "맛집", "카페", "밥", "점심", "저녁", "브런치", "디저트"];

export function buildMemorySemanticMetadata(item: RecordSearchItem) {
  const sourceText = normalize([item.title, item.description, item.tags.join(" "), item.facts?.map((fact) => fact.text).join(" ")].filter(Boolean).join(" "));
  const tags = new Set<string>();
  const aliases = new Set<string>();
  const cuisines = new Set<string>();

  if (item.type === "activity" && FOOD_WORDS.some((word) => sourceText.includes(word))) tags.add("음식");

  SEMANTIC_RULES.forEach((rule) => {
    if (!rule.aliases.some((alias) => sourceText.includes(normalize(alias)))) return;
    rule.tags.forEach((tag) => tags.add(tag));
    rule.aliases.forEach((alias) => aliases.add(alias));
    if (rule.cuisine) cuisines.add(rule.cuisine);
  });

  return {
    cuisines: [...cuisines],
    semanticAliases: [...aliases],
    semanticTags: [...tags],
  };
}

export function expandMemoryQuestion(question: string) {
  const normalizedQuestion = normalize(question);
  const expanded = new Set<string>([question]);

  SEMANTIC_RULES.forEach((rule) => {
    if (!rule.aliases.some((alias) => normalizedQuestion.includes(normalize(alias)))) return;
    rule.aliases.forEach((alias) => expanded.add(alias));
    rule.tags.forEach((tag) => expanded.add(tag));
    if (rule.cuisine) {
      expanded.add(`${rule.cuisine} 음식`);
      expanded.add(`${rule.cuisine} 요리`);
    }
  });

  if (FOOD_WORDS.some((word) => normalizedQuestion.includes(word))) {
    FOOD_WORDS.forEach((word) => expanded.add(word));
    expanded.add("음식점");
    expanded.add("식사");
  }

  return [...expanded].join(" ");
}

export function getDocumentSemanticText(document: MemoryDocument) {
  return [
    document.text,
    readStringArray(document.metadata.semanticTags).join(" "),
    readStringArray(document.metadata.semanticAliases).join(" "),
    readStringArray(document.metadata.cuisines).join(" "),
  ].filter(Boolean).join(" ");
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}
