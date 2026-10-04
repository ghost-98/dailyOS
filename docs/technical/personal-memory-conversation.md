# dailyOS Personal Memory Conversation

dailyOS의 기반 대화는 단순 키워드 검색이 아니라 사용자의 기록을 장기 기억처럼 재구성해 대화하는 시스템이다. 목표는 ChatGPT가 이전 대화를 기억하듯, dailyOS가 활동, 하루기록, 사진, 사람, 장소, 소비, 건강 기록을 근거로 맥락 있는 답변을 만드는 것이다.

## 구조

```txt
원천 기록
→ MemoryDocument 생성
→ MemorySummary 생성
→ 선택한 provider로 embedding 생성
→ Supabase memory_* 테이블과 pgvector에 동기화
→ 질문 수신
→ ConversationPolicy가 일반 대화/기억 회상/기억 분석 경로 결정
→ 일반 대화는 기록 검색 없이 LLM 응답
→ 기억 분석은 deterministic 분석 엔진 우선 처리
→ 기억 회상은 질문 embedding 생성 후 Supabase RPC vector search
→ 검색 실패 시 구조/키워드 fallback 랭킹
→ LLM 또는 로컬 기억 엔진 답변
→ 답변 말풍선과 펼침형 근거 기록 분리 표시
```

## 데이터 계층

- `memory_documents`: 원천 기록을 대화 가능한 문서로 바꾼 장기 기억 단위다. 활동, 일정, 할 일, 하루기록, 사진, 수입, 지출, 건강 기록과 함께 하루/월/사람/장소 요약 문서가 들어간다.
- `memory_summaries`: 최근 흐름, 월간 흐름, 사람별 흐름처럼 여러 기록을 압축한 요약 기억이다.
`memory_conversations`, `memory_messages` 테이블은 초기 설계에 포함됐지만 현재 화면 흐름에서는 사용하지 않는다. 대화 로그를 장기 기억으로 저장하지 않고, 현재 화면의 최근 메시지만 LLM에 전달한다. 장기 기억은 사용자가 입력한 실제 기록과 그 요약/임베딩만 담당한다.

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

기록 문서는 원문뿐 아니라 `semanticTags`, `semanticAliases`, `cuisines` 같은 의미 메타데이터도 갖는다. 예를 들어 `빠에야`, `감바스`, `타파스`가 있으면 `스페인음식`, `유럽음식`, `음식` 태그가 같이 저장된다. 질문도 같은 의미 사전으로 확장해서, 사용자가 "스페인음식 먹은 곳"처럼 물어도 관련 음식/장소 기록이 후보에 올라오게 한다.

동기화는 클라이언트가 Supabase 테이블에 직접 쓰지 않고 `POST /api/memory/sync`를 호출한다. 이 서버 API는 사용자 access token으로 RLS를 통과하는 Supabase client를 만들고, 설정된 embedding provider가 있으면 바뀐 문서만 임베딩한다. 기본값은 `MEMORY_EMBEDDING_PROVIDER=ollama`이며, 상용 API 없이 로컬 Ollama embedding만 사용한다. 기본 모델은 현재 DB `vector(768)`에 맞춘 `nomic-embed-text`다. 상용 API를 명시적으로 쓰고 싶을 때만 `MEMORY_EMBEDDING_PROVIDER=gemini` 또는 `auto`로 바꾼다.

임베딩 재생성 조건:

- DB에 문서가 없음
- 기존 문서에 embedding이 없음
- `title` 또는 `text`가 바뀜

변하지 않은 문서는 embedding 컬럼을 payload에서 생략해서 기존 vector를 보존한다.

## 대화 라우팅과 기억 선별

`POST /api/memory/chat`은 먼저 `conversationPolicy`로 질문을 분류한다. 이 단계의 역할은 LLM에게 모든 것을 맡기기 전에 질문이 어떤 처리 경로를 타야 하는지 결정하는 것이다. 상용 LLM 제품의 retrieval/router 계층과 같은 책임이다.

라우팅 경로:

- `general_chat`: assistant의 정체, 인사, 일반 대화처럼 개인 기록 검색이 필요 없는 질문. 기록을 뒤지지 않고 LLM이 짧게 답한다.
- `memory_recall`: "언제", "어디", "뭐 먹었지", "누구 만났지"처럼 기록에서 찾아야 하는 질문. semantic retrieval과 fallback 랭킹을 사용한다.
- `memory_analytics`: "얼마", "몇 번", "가장 많이", "비교", "추세"처럼 계산이나 집계가 필요한 질문. deterministic 분석 엔진을 우선 사용한다.

`conversationPolicy`는 질문을 다음 축으로 나눈다.

- intent: 분석, 회상, 대화
- domain: 돈, 사람, 장소, 건강, 활동, 일반
- date range: 오늘, 어제, 최근 30일, 이번 달, 지난 달, 명시 월, 전체 기간
- keywords: 검색과 답변 계획에 쓸 핵심어

특히 `너는 누구야`, `dailyOS는 뭐야`처럼 assistant에게 향한 질문은 `누구` 같은 단어가 들어 있어도 사람 기록 검색으로 보내지 않는다. 반대로 `내가 최근 누구를 만났지`처럼 사용자 기록 신호가 있으면 기억 회상 경로로 보낸다.

돈, 사람, 장소, 건강처럼 정확한 계산이나 집계가 필요한 질문은 `analyticsAnswer`가 먼저 처리한다. 예를 들어 "이번 달 지출 얼마야", "요즘 누구를 가장 많이 만났어", "최근 자주 간 곳은 어디야" 같은 질문은 LLM이 추측하지 않고 기록 문서의 금액, 사람, 장소, 날짜를 집계해서 답한다.

분석 엔진으로 충분히 처리되지 않는 질문의 기본 경로는 pgvector 기반 semantic retrieval이다. `POST /api/memory/chat`은 사용자 access token으로 Supabase RPC를 호출한다.

- `match_memory_documents`
- `match_memory_summaries`

두 함수는 `query_embedding vector(768)`과 `query_user_id`를 받아 cosine similarity 기준으로 관련 기억을 반환한다. SQL 내부에서 `query_user_id = auth.uid()` 조건을 확인하므로 다른 사용자의 기억을 가져올 수 없다.

`selectConversationMemory`는 fallback이자 보조 랭커다. Gemini embedding, Supabase RPC, 네트워크 중 하나가 실패했을 때 질문, 문서, 요약, 최근 대화를 받아 LLM에 넣을 기억을 고른다. 선별 기준은 다음을 섞는다.

- 질문 의미 확장: 음식 국적, 메뉴, 장소 유형, 활동 유형 동의어
- 질문 단어 매칭
- 돈/소비/지출, 사람, 장소, 운동/건강 같은 의도 점수
- 최근성
- 원본 기록과 요약 기억의 균형
- 최근 대화 맥락

단, 신뢰도 원칙상 기록, 장소명, 메뉴, 메모, 장소 카테고리 중 어디에도 특정 음식 국적이나 업종 단서가 없으면 시스템은 그 사실을 만들어내지 않는다. 그런 경우까지 안정적으로 답하려면 장소 저장 시점에 provider category, 지도 검색 결과, 또는 LLM 기반 장소 enrichment를 별도 메모리로 저장해야 한다.

LLM context에는 전체 DB가 아니라 관련 원본 기억, 장기 요약, 최근 대화만 들어간다. 이렇게 해야 답변 품질과 비용, 속도를 같이 잡을 수 있다.

## 서버 답변

구현 위치:

- `src/app/api/memory/chat/route.ts`
- `src/features/memory-conversation/conversationPolicy.ts`
- `src/features/memory-conversation/memoryPrompts.ts`
- `src/features/memory-conversation/memorySemantics.ts`
- `src/features/memory-conversation/analyticsAnswer.ts`

API는 `POST /api/memory/chat`으로 동작한다. 요청에는 질문, 메모리 문서, 요약, 현재 화면 안의 최근 메시지가 들어온다.

`route.ts`는 직접 라우팅 규칙이나 프롬프트 문장을 소유하지 않고 다음 모듈을 조립한다.

- `conversationPolicy`: 질문 처리 경로와 질문 계획 결정
- `memoryPrompts`: 일반 대화 prompt와 기억 기반 답변 prompt 생성
- `semanticRetrieval`: pgvector 기반 장기 기억 검색
- `analyticsAnswer`: deterministic 분석 답변
- `memoryDocuments`: fallback 기억 선별과 로컬 답변

일반 대화는 `buildGeneralChatPrompt`만 사용하고 기록 검색을 하지 않는다. 기억 회상/분석 질문은 질문 embedding을 만들고 Supabase RPC로 관련 기억을 검색한다. 검색 결과가 충분하면 그 기억을 LLM context로 사용한다. 검색이 불가능한 경우에만 클라이언트가 보낸 문서와 요약을 fallback 랭킹한다.

분석형 질문은 LLM 호출 전에 deterministic 답변을 우선 반환한다. 이렇게 해야 금액, 빈도, 장소 순위처럼 틀리면 안 되는 질문을 생성 모델의 문장 감각에 맡기지 않는다. 대화형 질문은 질문 처리 계획을 프롬프트에 함께 넣어, 같은 기억이라도 회상형/분석형/상담형 톤을 다르게 잡는다.

환경 변수:

- `MEMORY_CHAT_PROVIDER` optional, 기본값 `ollama`, 선택값 `ollama`, `auto`, `gemini`
- `MEMORY_EMBEDDING_PROVIDER` optional, 기본값 `ollama`, 선택값 `ollama`, `auto`, `gemini`
- `OLLAMA_BASE_URL` optional, 기본값 `http://localhost:11434`
- `OLLAMA_CHAT_MODEL` optional, 기본값 `qwen3:8b`
- `OLLAMA_EMBEDDING_MODEL` optional, 기본값 `nomic-embed-text`
- `GEMINI_API_KEY` optional, 상용 API를 명시적으로 쓸 때만 필요
- `GEMINI_MODEL` optional, 기본값 `gemini-1.5-flash`
- `GEMINI_EMBEDDING_MODEL` optional, 미설정 시 `gemini-embedding-2`, `gemini-embedding-001` 순서로 자동 시도

기억 기반 질문에서 LLM 호출이 실패하거나 provider가 설정되지 않으면 `buildLocalMemoryAnswer`가 같은 기억 선별 결과로 로컬 답변을 만든다. 일반 대화에서는 기록 fallback을 사용하지 않는다. 모델 연결이 실패하면 로컬 대화 모델 연결 문제를 알려준다. 다만 ChatGPT 수준의 답변 품질은 좋은 chat provider가 있을 때 나오고, 의미 검색 품질은 embedding과 pgvector RPC가 적용된 상태에서 나온다.

로컬 전용 설정 예시:

```env
MEMORY_EMBEDDING_PROVIDER=ollama
MEMORY_CHAT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=qwen3:8b
```

라즈베리파이에서 속도와 메모리가 부담되면 `OLLAMA_CHAT_MODEL=qwen3:4b`로 시작한다. 품질이 더 필요하면 같은 네트워크의 더 강한 PC/GPU 서버에서 Ollama를 띄우고 `OLLAMA_BASE_URL`만 그 서버 주소로 바꾼다.

상용 API를 품질 우선 fallback으로 쓰는 설정 예시:

```env
MEMORY_EMBEDDING_PROVIDER=auto
MEMORY_CHAT_PROVIDER=auto
GEMINI_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=qwen3:8b
```

이 설정은 Gemini를 먼저 사용하고 quota/장애가 나면 Ollama로 fallback한다. API 없는 운영을 원하면 이 설정을 쓰지 않는다.

현재 SQL은 `vector(768)` 기준이다. `bge-m3`처럼 1024차원 embedding 모델을 쓰려면 Supabase의 `embedding vector(768)` 컬럼과 RPC 인자 차원도 함께 바꿔야 한다.

## 화면

구현 위치:

- `src/features/screens/search/SearchView.tsx`

`/m/search`는 두 모드를 가진다.

- 검색: 기존 키워드 검색
- 기록 대화: 개인 기억 기반 대화

기록 대화 화면은 다음을 제공한다.

- 메모리 동기화 상태
- 질문 입력
- 최근 대화
- 답변 말풍선
- 접을 수 있는 근거 기록 카드
- 선택형 후속 질문 버튼

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
3. Ollama 서버를 켜고 `MEMORY_EMBEDDING_PROVIDER=ollama`, `MEMORY_CHAT_PROVIDER=ollama`를 설정한다.
4. 상용 API를 쓰고 싶을 때만 `.env.local`에 `GEMINI_API_KEY`를 설정한다.
5. 기본 모델을 바꾸고 싶으면 `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBEDDING_MODEL`을 설정한다. 현재 DB vector 차원은 `768` 기준이다. 다른 차원 모델을 쓰면 SQL의 `vector(768)`도 같이 바꿔야 한다.
6. 앱에서 `/m/search`의 `기록 대화` 탭을 열면 현재 기록 스냅샷이 서버 동기화 API를 통해 장기 기억과 embedding으로 저장된다.

## 설계 원칙

- LLM은 원천 기록을 생성하지 않는다.
- 일반 대화와 기억 기반 질문을 먼저 분리한다.
- 기억 기반 답변은 반드시 기억 문서나 요약 기억을 근거로 한다.
- 계산 가능한 질문은 LLM보다 deterministic 분석 엔진이 먼저 답한다.
- 원문에 없는 장소/메뉴 속성은 추측하지 않고, enrichment로 저장된 의미 메타데이터가 있을 때만 사용한다.
- 원본 기록 링크는 답변 본문에 섞지 않고 별도 근거 패널로 제공한다.
- 대화 로그는 장기 기억으로 저장하지 않는다. 장기 기억은 사용자가 입력한 실제 기록과 요약만 담당한다.
- 장기 기억과 embedding은 Supabase에 저장하고, 즉시 대화 품질은 클라이언트가 가진 최신 스냅샷 fallback으로 보장한다.
- 기본 구조는 API 키 없이 로컬 Ollama provider로 semantic recall과 LLM 답변을 수행한다. 상용 API는 선택 옵션이다.
