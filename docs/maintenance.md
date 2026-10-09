# 유지보수 안내

2026-10-09 코드 정리 기준이다. 사용자 기록의 원천은 Supabase의 기존 도메인 테이블이며, 기록 대화 UI에는 데이터 처리나 모델 연결이 없다.

## 코드를 읽는 순서

1. `src/app/m/*/page.tsx`: 화면 라우트 진입점.
2. `src/features/screens/*`: 화면 조합, 폼, 상세 패널.
3. `src/features/records/state/recordsDataLoader.ts`: 공유 기록 스냅샷과 로딩.
4. `src/features/records/state/useRecordsDataState.ts`: 화면용 데이터 상태.
5. `src/features/data/*`: 도메인별 Supabase CRUD.
6. `src/types/domain.ts`: 공유 도메인 타입.

## 검색 및 사람 조회

- `screens/search/SearchView.tsx`: 탭 전환과 패널 구성.
- `screens/search/KeywordSearchPanel.tsx`: 검색어, 기간, 결과와 하루 상세 이동.
- `screens/search/RecordConversationPlaceholder.tsx`: 비활성 대화 UI만 렌더링.
- `records/search/recordSearchItems.ts`: 키워드 검색 인덱스와 표시용 검색 사실 조립.
- `records/people/recordPeople.ts`: 함께한 사람 파싱과 사람별 기록 집계.
- `records/format/recordFormatters.ts`: 공통 표시 형식.
- `app/styles/search.css`: 검색 및 비활성 대화 패널 스타일.

폐기한 `recordsInsights.ts`에는 검색, 사람 집계, 미사용 하루 맥락 조립, 자연어 질문 점수화가 섞여 있었다. 현재는 실제 사용 중인 책임별 모듈로 분리했다. 대형 기록 입력과 하루 상세 모듈은 기존 동작을 유지하며 독립 작업에서 다룬다.

기존 `data/records/api.ts`는 `data/activities/api.ts`, `data/logs/api.ts`, `data/photos/api.ts`로 분리했다. 소비자는 필요한 도메인을 직접 import한다. 활동의 연결 지출 처리, 사진의 signed URL과 오류 처리, 사용자별 데이터 격리는 그대로 유지한다.

## 제거 범위

- 메모리 문서 생성과 요약, 질문 분류, 프롬프트, 의미 검색, 분석 응답, 모델 provider 코드.
- `/api/memory/chat`, `/api/memory/sync`, 클라이언트 동기화 API.
- 호출되지 않는 CRUD, 캘린더 표시 상수, 과거 검색·맥락 조립 함수와 장소 변환 모듈.
- 참조 없는 과거 화면 CSS. 템플릿 기반 동적 클래스와 복합 의사 클래스는 보수적으로 유지.
- 모델 환경 변수 예시와 폐기된 자연어 검색 설계·기술 문서.

과거 SQL 마이그레이션은 실행 이력이므로 삭제하지 않는다. 운영 DB와 설치된 서버 소프트웨어는 소스 파일 삭제로 제거되지 않는다. 서버 정리 절차는 `remove-local-models.md`를 따른다.

## 검증 명령

```bash
npm run audit:unused
npm run test:records
npm run typecheck
npm run lint
npm run build
```

`audit:unused`는 라우트에서 도달하지 않는 TypeScript 모듈과 외부 named import가 없는 export 후보를 보고한다. 프레임워크 진입점, 내부 참조와 동적 로딩을 확인한 뒤 판단한다. CSS 점검은 `node scripts/audit-css.mjs`로 실행한다. 클래스명의 문자열·템플릿 참조를 기반으로 하므로 결과만 보고 자동 삭제하지 않는다.

라우트를 삭제한 뒤 `.next/types`에 옛 API 타입이 남아 있다면 빌드를 통해 생성 타입을 갱신한다. `noUnusedLocals`, `noUnusedParameters`는 유지하여 내부 미사용 코드가 추가되면 타입 검사에서 드러나도록 한다.
