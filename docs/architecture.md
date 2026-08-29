# dailyOS Architecture

이 문서는 dailyOS를 계속 키울 때 길을 잃지 않기 위한 현재 구조 기준이다.

## 제품 구조

dailyOS는 세 계층으로 나눈다.

1. **입력 계층**
   - 일정·할일·이벤트: `/life/plans`
   - 활동 기록: `/life/activities`
   - 하루기록: `/life/logs`
   - 건강: `/life/health`
2. **조회·해석 계층**
   - 라이프 DB 홈: `/life`
   - 라이프 캘린더: `/life/calendar`
   - 갤러리: `/life/gallery`
   - 사람: `/life/people`
   - 장소: `/life/places`
   - 전체 검색: `/life/search`
   - AI 질문: `/life/ask`
3. **보조 관리 계층**
   - 가계부: `/ledger`
   - 장소 보관함: `/places`
   - 설정/백업: `/settings`

## 데이터 연결 원칙

- 일정·할일·이벤트는 계획과 약속의 축이다.
- 활동 기록은 실제로 한 행동의 축이다.
- 지출은 단독 입력하지 않고 일정·할일·이벤트·활동에서 파생한다.
- 사진과 하루기록은 날짜에 반드시 연결되고, 가능하면 일정·할일·이벤트·활동 중 하나에 느슨하게 연결한다.
- 장소는 일정·할일·이벤트·활동에서 나온 장소 흐름과, 별도 보관함의 장소 자산을 분리한다.
- 건강은 날짜 기준으로 하루 리포트와 월간 회고에 합류한다.
- 사람 데이터는 현재 문자열 기반 연결이며, 별도 `people` 테이블은 향후 정규화 확장 지점이다.

## 코드 구조

- `src/app`: Next.js 라우트 진입점. 대부분 `AppShell` + feature view만 연결한다.
- `src/components`: 인증, 레이아웃, 공통 UI.
- `src/features/calendar`: 일정·할일·이벤트 입력과 캘린더 UI.
- `src/features/life`: 라이프 DB 홈, 검색, AI 질문, 활동/기록/갤러리/건강/장소 흐름.
- `src/features/ledger`: 파생 지출 조회.
- `src/features/places`: 장소 보관함.
- `src/features/settings`: 계정, 백업, 데이터 관리.
- `src/lib`: Supabase 클라이언트와 인증 사용자 헬퍼.
- `src/types/domain.ts`: 앱에서 공유하는 핵심 도메인 타입.
- `supabase/schema.sql`: DB 테이블, RLS, 스토리지 정책의 단일 기준.

## 현재 리팩터링 기준

- 화면 데이터 로딩은 가능한 한 공통 훅으로 묶고, feature 내부에서 스냅샷 단위로 다룬다.
- `LifeView.tsx`, `CalendarView.tsx` 같은 대형 파일은 화면 라우팅/조합과 데이터 로딩을 분리하고, 탭 화면과 시트/패널은 별도 파일로 분리한다.
- AI 질문은 `질문 UI`, `질문 분석`, `API 호출` 계층을 분리한다.
- 스타일은 `life.css`, `calendar.css` 같은 대형 파일에 계속 누적하지 않고, 레이아웃/DB 패널/셸 단위로 쪼갠다.

## 유지보수 기준

- 새 데이터 입력은 먼저 도메인 타입과 Supabase 스키마를 맞춘다.
- 새 조회 화면은 기존 원천 데이터를 재사용하고 별도 중복 테이블을 만들지 않는다.
- 라우트 파일은 얇게 유지하고, 실제 로직은 `src/features/*`에 둔다.
- API 파일의 인증 사용자 조회는 `src/lib/authUser.ts`를 쓴다.
- 실사용 저장/삭제 액션은 로딩, 성공, 실패 메시지를 화면에 표시한다.
- 큰 화면 파일(`LifeView.tsx`, `CalendarView.tsx`, `CareerView.tsx`)은 다음 대형 작업 때 하위 컴포넌트로 분리한다.

## 실서비스 전 체크리스트

- `npm run typecheck`, `npm run lint`, `npm run build` 통과
- Supabase SQL 최신본 적용
- `life-media` 스토리지 버킷과 RLS 정책 확인
- `.env.local`에 Supabase, Gemini, Naver 키 설정
- Settings에서 백업 내보내기/가져오기 동작 확인
- 라즈베리파이 배포 시 `npm run build && npm run start` 또는 PM2 실행 확인
