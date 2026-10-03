# dailyOS Personal Memory Conversation

dailyOS의 기반 대화는 단순 키워드 검색이 아니라 사용자의 기록을 장기 기억처럼 재구성해 대화하는 시스템이다. 목표는 ChatGPT가 이전 대화를 기억하듯, dailyOS가 활동, 하루기록, 사진, 사람, 장소, 소비, 건강 기록을 근거로 맥락 있는 답변을 만드는 것이다.

## 구조

```txt
원천 기록
→ MemoryDocument 생성
→ MemorySummary 생성
→ Gemini embedding 생성
→ Supabase memory_* 테이블과 pgvector에 동기화
→ 질문 수신
→ 질문 embedding 생성
→ Supabase RPC vector search
→ 구조/키워드 fallback 랭킹
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

## 메모리 생성과 임베딩

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

동기화는 클라이언트가 Supabase 테이블에 직접 쓰지 않고 `POST /api/memory/sync`를 호출한다. 이 서버 API는 사용자 access token으로 RLS를 통과하는 Supabase client를 만들고, `GEMINI_API_KEY`가 있으면 바뀐 문서만 `text-embedding-004`로 임베딩한다.

임베딩 재생성 조건:

- DB에 문서가 없음
- 기존 문서에 embedding이 없음
- `title` 또는 `text`가 바뀜

변하지 않은 문서는 embedding 컬럼을 payload에서 생략해서 기존 vector를 보존한다.

## 기억 선별

기본 경로는 pgvector 기반 semantic retrieval이다. `POST /api/memory/chat`은 사용자 access token으로 Supabase RPC를 호출한다.

- `match_memory_documents`
- `match_memory_summaries`

두 함수는 `query_embedding vector(768)`과 `query_user_id`를 받아 cosine similarity 기준으로 관련 기억을 반환한다. SQL 내부에서 `query_user_id = auth.uid()` 조건을 확인하므로 다른 사용자의 기억을 가져올 수 없다.

`selectConversationMemory`는 fallback이자 보조 랭커다. Gemini embedding, Supabase RPC, 네트워크 중 하나가 실패했을 때 질문, 문서, 요약, 최근 대화를 받아 LLM에 넣을 기억을 고른다. 선별 기준은 다음을 섞는다.

- 질문 단어 매칭
- 돈/소비/지출, 사람, 장소, 운동/건강 같은 의도 점수
- 최근성
- 원본 기록과 요약 기억의 균형
- 최근 대화 맥락

LLM context에는 전체 DB가 아니라 관련 원본 기억, 장기 요약, 최근 대화만 들어간다. 이렇게 해야 답변 품질과 비용, 속도를 같이 잡을 수 있다.

## 서버 답변

구현 위치:

- `src/app/api/memory/chat/route.ts`

API는 `POST /api/memory/chat`으로 동작한다. 요청에는 질문, 메모리 문서, 요약, 최근 메시지가 들어온다. 서버는 먼저 질문 embedding을 만들고 Supabase RPC로 관련 기억을 검색한다. 검색 결과가 충분하면 그 기억을 LLM context로 사용한다. 검색이 불가능한 경우에만 클라이언트가 보낸 문서와 요약을 fallback 랭킹한다.

환경 변수:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` optional, 기본값 `gemini-1.5-flash`
- `GEMINI_EMBEDDING_MODEL` optional, 기본값 `text-embedding-004`

Gemini 호출이 실패하거나 키가 없으면 `buildLocalMemoryAnswer`가 같은 기억 선별 결과로 로컬 답변을 만든다. 따라서 API 키가 없어도 기능은 완전히 죽지 않는다. 다만 ChatGPT 수준의 의미 검색 품질은 embedding과 pgvector RPC가 적용된 상태에서 나온다.

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

마이그레이션은 `vector` 확장, `embedding vector(768)` 컬럼, HNSW vector index, semantic search RPC를 포함한다.

RPC:

- `match_memory_documents(query_embedding vector(768), query_user_id uuid, match_count int, match_threshold float)`
- `match_memory_summaries(query_embedding vector(768), query_user_id uuid, match_count int, match_threshold float)`

두 함수는 `1 - (embedding <=> query_embedding)`으로 cosine similarity를 반환한다.

## 사용자가 해야 하는 것

완성 기능을 실제 서비스에서 쓰려면 다음 설정이 필요하다.

1. Supabase SQL Editor 또는 migration 적용 절차로 `supabase/migrations/20261003_add_memory_conversation.sql`을 적용한다.
2. Supabase 프로젝트에서 `vector` 확장이 활성화되는지 확인한다. 마이그레이션에 `create extension if not exists vector;`가 들어 있다.
3. `.env.local`에 `GEMINI_API_KEY`를 설정한다.
4. 기본 모델을 바꾸고 싶으면 `GEMINI_MODEL`, 임베딩 모델을 바꾸고 싶으면 `GEMINI_EMBEDDING_MODEL`을 설정한다. 현재 DB vector 차원은 `text-embedding-004` 기준 `768`이다. 다른 차원 모델을 쓰면 SQL의 `vector(768)`도 같이 바꿔야 한다.
5. 앱에서 `/m/search`의 `기록 대화` 탭을 열면 현재 기록 스냅샷이 서버 동기화 API를 통해 장기 기억과 embedding으로 저장된다.

## 설계 원칙

- LLM은 원천 기록을 생성하지 않는다.
- 답변은 반드시 기억 문서나 요약 기억을 근거로 한다.
- 원본 기록 링크를 답변과 함께 제공한다.
- 장기 기억과 embedding은 Supabase에 저장하고, 즉시 대화 품질은 클라이언트가 가진 최신 스냅샷 fallback으로 보장한다.
- API 키가 없어도 로컬 기억 답변으로 앱 사용 흐름은 유지하지만, 완성형 semantic recall은 `GEMINI_API_KEY`와 pgvector RPC가 있을 때 동작한다.
