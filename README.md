# dailyOS

개인의 하루, 장소, 소비, 사진, 건강, 커리어 데이터를 한곳에 쌓고 다시 꺼내 쓰기 위한 개인 Life Database OS입니다.

## 핵심 가치

- **기록 입력**: 일정·할일·활동·하루기록·사진·건강 데이터를 날짜와 맥락에 연결합니다.
- **하루 복원**: 오늘/하루 리포트에서 그날의 행동, 소비, 장소, 사람, 사진, 운동을 한 장으로 봅니다.
- **회고와 검색**: 월간 회고, 전체 검색, AI 질문으로 쌓인 기록에서 의미를 찾습니다.
- **개인 운영**: 가계부, 장소 보관함, 커리어 관리를 라이프 DB와 느슨하게 연결합니다.

## 주요 화면

- `/` 오늘: 오늘의 기록 밀도, 타임라인, 하루기록, 사진, 장소, 지출, 건강 요약
- `/life` 라이프 DB 홈: 데이터 모델과 주요 진입점
- `/life/calendar` 캘린더: 일정·할일·이벤트 입력과 날짜별 관리
- `/life/activities` 활동 기록: 실제로 한 행동을 시간·장소·사람·음식·소비와 함께 기록
- `/life/report` 하루 리포트: 선택 날짜의 모든 기록을 통합 조회
- `/life/monthly` 월간 회고: 월 단위 요약과 패턴
- `/life/search` 전체 검색: 기록 전반 검색
- `/life/ask` AI 질문: 자연어 질문으로 관련 기록 선별
- `/life/logs` 하루기록, `/life/photos` 사진, `/life/health` 건강 입력
- `/places` 장소 보관함, `/ledger` 가계부, `/career/*` 커리어 관리, `/settings` 설정

## 개발 명령

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## 환경 변수

`.env.example`을 복사해 `.env.local`을 만들고 Supabase, Gemini, Naver Maps/Search 키를 입력합니다.

## 문서

- `docs/architecture.md`: 현재 코드/데이터 구조와 관리 기준
- `docs/raspberry-pi-deploy.md`: 라즈베리파이 배포 순서
- `docs/dailyos-ui-design.md`: UI 디자인 방향
