# dailyOS Personal Memory Conversation

dailyOS의 기반 대화는 단순 키워드 검색이 아니라 사용자의 기록을 장기 기억처럼 재구성해 대화하는 시스템이다. 목표는 ChatGPT가 이전 대화를 기억하듯, dailyOS가 활동, 하루기록, 사진, 사람, 장소, 소비, 건강 기록을 근거로 맥락 있는 답변을 만드는 것이다.

## 구조

```txt
원천 기록
→ MemoryDocument 생성
→ MemorySummary 생성
→ Supabase memory_* 테이블 동기화
→ 질문 수신
→ 관련 기억 선별
→ LLM 또는 로컬 기억 엔진 답변
→ 답변, 근거 기록, 후속 질문 표시
→ 대화 메시지 저장
```

## 데이터 계층

- `memory_documents`: 원천 기록을 대화 가능한 문서로 바꾼 장기 기억 단위다. 활동, 일정, 할 일, 하루기록, 사진, 수입, 지출, 건강 기록과 함께 하루/월/사람/장소 요약 문서가 들어간다.
- `memory_summaries`: 최근 흐름, 월간 흐름, 사람별 흐름처럼 여러 기록을 압축한 요약 기억이다.
- `memory_conversations`: 사용자가 dailyOS와 나눈 기록 기반 대화 세션이다.
- `memory_messages`: 세션 안의 사용자/assistant 메시지다.

각 테이블은 `user_id` 기준 RLS를 사용한다. 다른 사용자의 기억이나 대화는 읽거나 쓸 수 없다.

## 메모리 생성

구현 위치:

- `src/features/memory-conversation/memoryDocuments.ts`
- `src/features/memory-conversation/types.ts`

`buildMemoryDocuments`는 현재 로드된 `RecordDataSnapshot`을 받아 다음을 만든다.

- 원본 기록 문서
- 하루 요약 문서
- 사람별 요약 문서
- 장소별 요약 문서
- 월간 요약 문서

문서는 날짜, 제목, 유형, 원문 텍스트, 근거 이동용 `focusId`, 사람/장소/fact 메타데이터를 갖는다.

## 기억 선별

`selectConversationMemory`가 질문, 문서, 요약, 최근 대화를 받아 LLM에 넣을 기억을 고른다. 선별 기준은 다음을 섞는다.

- 질문 단어 매칭
- 돈/소비/지출, 사람, 장소, 운동/건강 같은 의도 점수
- 최근성
- 원본 기록과 요약 기억의 균형
- 최근 대화 맥락

LLM context에는 전체 DB가 아니라 관련 원본 기억, 장기 요약, 최근 대화만 들어간다. 이렇게 해야 답변 품질과 비용, 속도를 같이 잡을 수 있다.

## 서버 답변

구현 위치:

- `src/app/api/memory/chat/route.ts`

API는 `POST /api/memory/chat`으로 동작한다. 요청에는 질문, 메모리 문서, 요약, 최근 메시지가 들어온다. 서버는 다시 기억을 선별한 뒤 `GEMINI_API_KEY`가 있으면 Gemini에 JSON 답변을 요청한다.

환경 변수:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` optional, 기본값 `gemini-1.5-flash`

Gemini 호출이 실패하거나 키가 없으면 `buildLocalMemoryAnswer`가 같은 기억 선별 결과로 로컬 답변을 만든다. 따라서 API 키가 없어도 기능은 완전히 죽지 않는다.

## 화면

구현 위치:

- `src/features/screens/search/SearchView.tsx`

`/m/search`는 두 모드를 가진다.

- 검색: 기존 키워드 검색
- 기록 대화: 개인 기억 기반 대화

기록 대화 화면은 다음을 제공한다.

- 메모리 동기화 상태
- 질문 입력
- 예시 질문
- 최근 대화
- 답변
- 근거 기록 카드
- 후속 질문 버튼

근거 기록 카드는 `createDayRecordHref`를 통해 해당 날짜와 기록으로 이동한다.

## Supabase 적용

기준 스키마:

- `supabase/schema.sql`

마이그레이션:

- `supabase/migrations/20261003_add_memory_conversation.sql`

마이그레이션은 `vector` 확장과 `embedding vector(768)` 컬럼을 포함한다. 현재 앱 구현은 하이브리드 텍스트/구조 점수로 선별하지만, 테이블은 pgvector 기반 embedding 검색으로 확장될 수 있게 준비되어 있다.

## 설계 원칙

- LLM은 원천 기록을 생성하지 않는다.
- 답변은 반드시 기억 문서나 요약 기억을 근거로 한다.
- 원본 기록 링크를 답변과 함께 제공한다.
- 장기 기억은 Supabase에 저장하고, 즉시 대화 품질은 클라이언트가 가진 최신 스냅샷으로 보장한다.
- API 키가 없어도 로컬 기억 답변으로 앱 사용 흐름은 유지한다.
